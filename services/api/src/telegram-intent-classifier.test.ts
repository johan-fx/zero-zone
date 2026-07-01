import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_TELEGRAM_INTENT_CONFIDENCE_THRESHOLD,
  DEFAULT_TELEGRAM_INTENT_MODEL,
  classifyTelegramIntent,
  resolveTelegramIntentRouterConfig,
  type TelegramIntentAiBinding,
} from './telegram-intent-classifier';

function createAi(response: unknown): TelegramIntentAiBinding & { run: ReturnType<typeof vi.fn> } {
  return {
    run: vi.fn(async () => response),
  };
}

describe('telegram intent classifier', () => {
  it('uses deterministic Workers AI JSON classification defaults', async () => {
    const ai = createAi({
      choices: [
        {
          message: {
            content: JSON.stringify({
              intent: 'resource',
              confidence: 0.92,
              reason: 'The user is offering potable water.',
              extractedFacts: { resourceType: 'potable_water' },
            }),
          },
        },
      ],
    });

    const result = await classifyTelegramIntent({ ai, text: 'Tenemos agua potable para entregar', context: { locale: 'es' } });

    expect(result.intent).toBe('resource');
    expect(ai.run).toHaveBeenCalledWith(
      DEFAULT_TELEGRAM_INTENT_MODEL,
      expect.objectContaining({
        temperature: 0,
        max_tokens: 160,
        response_format: expect.objectContaining({ type: 'json_schema' }),
      }),
    );
  });

  it('returns family_reunification for valid missing-person output', async () => {
    const ai = createAi({
      response: {
        intent: 'family_reunification',
        confidence: 0.96,
        reason: 'The user is looking for a missing child.',
        extractedFacts: { subject: 'child' },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Busco a mi hija desaparecida' })).resolves.toMatchObject({
      intent: 'family_reunification',
      confidence: 0.96,
    });
  });

  it('downgrades low-confidence classifications to ambiguous', async () => {
    const ai = createAi({
      response: {
        intent: 'dispatch',
        confidence: 0.6,
        reason: 'Could be a logistics update.',
        extractedFacts: {},
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Necesito mover cosas', confidenceThreshold: 0.75 })).resolves.toMatchObject({
      intent: 'ambiguous',
      confidence: 0.6,
      extractedFacts: { proposedIntent: 'dispatch' },
    });
  });

  it('returns unknown instead of throwing on AI, JSON, or schema failures', async () => {
    await expect(classifyTelegramIntent({ ai: createAi('not-json'), text: 'hola' })).resolves.toMatchObject({ intent: 'unknown', confidence: 0 });
    await expect(
      classifyTelegramIntent({
        ai: createAi({ response: { intent: 'resource', confidence: 2, extractedFacts: {} } }),
        text: 'agua',
      }),
    ).resolves.toMatchObject({ intent: 'unknown', confidence: 0 });
    await expect(
      classifyTelegramIntent({
        ai: { run: vi.fn(async () => { throw new Error('boom'); }) },
        text: 'agua',
      }),
    ).resolves.toMatchObject({ intent: 'unknown', confidence: 0 });
  });

  it('resolves safe router configuration defaults and explicit overrides', () => {
    expect(resolveTelegramIntentRouterConfig({})).toEqual({
      enabled: false,
      model: DEFAULT_TELEGRAM_INTENT_MODEL,
      confidenceThreshold: DEFAULT_TELEGRAM_INTENT_CONFIDENCE_THRESHOLD,
    });

    expect(
      resolveTelegramIntentRouterConfig({
        TELEGRAM_INTENT_ROUTER_ENABLED: 'on',
        TELEGRAM_INTENT_MODEL: '@cf/custom/model',
        TELEGRAM_INTENT_CONFIDENCE_THRESHOLD: '0.8',
      }),
    ).toEqual({
      enabled: true,
      model: '@cf/custom/model',
      confidenceThreshold: 0.8,
    });
  });
});
