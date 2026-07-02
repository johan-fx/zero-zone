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
  it('uses deterministic Workers AI JSON classification defaults and typed schema hints', async () => {
    const ai = createAi({
      choices: [
        {
          message: {
            content: JSON.stringify({
              intent: 'resource',
              confidence: 0.92,
              reason: 'The user is offering potable water.',
              extractedFacts: {
                resourceDirection: 'offer',
                resourceType: 'water',
                resourceLabel: 'agua potable',
                implicitQuestion: 'where_needed',
              },
            }),
          },
        },
      ],
    });

    const result = await classifyTelegramIntent({ ai, text: 'Tenemos agua potable para entregar', context: { locale: 'es' } });

    expect(result.intent).toBe('resource');
    expect(result.extractedFacts).toMatchObject({
      resourceDirection: 'offer',
      resourceType: 'water',
      resourceLabel: 'agua potable',
      implicitQuestion: 'where_needed',
    });
    expect(ai.run).toHaveBeenCalledWith(
      DEFAULT_TELEGRAM_INTENT_MODEL,
      expect.objectContaining({
        temperature: 0,
        max_tokens: 280,
        response_format: expect.objectContaining({ type: 'json_schema' }),
      }),
    );

    const firstCall = ai.run.mock.calls[0] as [string, Record<string, unknown>];
    const request = firstCall[1];
    const messages = request.messages as Array<{ role: string; content: string }>;
    expect(messages[0]?.content).toContain('"tengo agua potable, dónde la necesitan?" => intent resource');
    expect(messages[0]?.content).toContain('"hay un puesto médico en la escuela con prioridad alta y necesitan medicamentos" => intent workcenter');
    expect(messages[0]?.content).toContain('Never geocode locationHint or output coordinates');
    expect(messages[0]?.content).toContain('"found a separated child near gate 2" => intent family_reunification');
    expect(messages[0]?.content).toContain('"hay dos personas atrapadas en la escalera este" => intent sos');
    expect(messages[0]?.content).toContain('"equipo en camino al almacén" => intent dispatch');
    expect(messages[0]?.content).toContain('"quiero unirme al incidente demo como voluntario" => intent incident_join');
    expect(messages[0]?.content).toContain('Do not include actions to execute, raw user text, phone numbers, names, or other PII');
    expect(messages[0]?.content).toContain('"puedo llevar comida" => intent resource');
    expect(messages[0]?.content).toContain('"me sobra medicina" => intent resource');
    expect(messages[0]?.content).toContain('"necesitamos mantas" => intent resource');
    expect(request.response_format).toMatchObject({
      json_schema: {
        properties: {
          extractedFacts: {
            properties: {
              resourceDirection: expect.objectContaining({ enum: ['offer', 'need', 'report', 'unknown'] }),
              resourceType: expect.objectContaining({
                enum: ['water', 'food', 'medicine', 'shelter', 'equipment', 'transport', 'fuel', 'other', 'unknown'],
              }),
              resourceLabel: expect.objectContaining({ type: 'string' }),
              quantityApprox: expect.objectContaining({ type: 'string' }),
              locationHint: expect.objectContaining({ type: 'string' }),
              implicitQuestion: expect.objectContaining({ enum: ['where_needed', 'where_available', 'how_to_deliver', 'none'] }),
              signal: expect.objectContaining({
                enum: expect.arrayContaining(['capacity', 'status_update', 'request_join']),
              }),
              status: expect.objectContaining({ enum: expect.arrayContaining(['active', 'en_route']) }),
              name: expect.objectContaining({ type: 'string' }),
              priority: expect.objectContaining({ enum: ['low', 'medium', 'high', 'critical'] }),
              initialNeed: expect.objectContaining({ type: 'string' }),
              surplus: expect.objectContaining({ type: 'string' }),
              caseType: expect.objectContaining({ enum: ['missing_person', 'found_person', 'separated_group', 'reunification_info', 'unknown'] }),
              subjectType: expect.objectContaining({ enum: ['child', 'adult', 'elderly', 'group', 'unknown'] }),
              severity: expect.objectContaining({ enum: ['critical', 'medical', 'security', 'trapped', 'other'] }),
              peopleCountApprox: expect.objectContaining({ type: 'string' }),
              destinationHint: expect.objectContaining({ type: 'string' }),
              incidentHint: expect.objectContaining({ type: 'string' }),
              roleHint: expect.objectContaining({ enum: ['volunteer', 'coordinator', 'logistics', 'medical'] }),
            },
          },
        },
      },
    });
  });

  it.each([
    [
      'tengo agua potable, dónde la necesitan?',
      {
        resourceDirection: 'offer',
        resourceType: 'water',
        resourceLabel: 'agua potable',
        implicitQuestion: 'where_needed',
      },
    ],
    ['puedo llevar comida', { resourceDirection: 'offer', resourceType: 'food', resourceLabel: 'comida' }],
    ['me sobra medicina', { resourceDirection: 'offer', resourceType: 'medicine', resourceLabel: 'medicina' }],
    ['necesitamos mantas', { resourceDirection: 'need', resourceType: 'shelter', resourceLabel: 'mantas' }],
  ])('preserves typed resource facts for "%s"', async (text, extractedFacts) => {
    const ai = createAi({
      response: {
        intent: 'resource',
        confidence: 0.91,
        reason: 'The user is describing resources.',
        extractedFacts,
      },
    });

    await expect(classifyTelegramIntent({ ai, text })).resolves.toMatchObject({
      intent: 'resource',
      confidence: 0.91,
      extractedFacts,
    });
  });

  it.each([
    [
      'hay un puesto médico en la escuela con prioridad alta y necesitan medicamentos',
      {
        signal: 'availability',
        name: 'puesto médico',
        locationHint: 'escuela',
        priority: 'high',
        initialNeed: 'medicamentos',
        implicitQuestion: 'none',
      },
    ],
    [
      'north shelter is active and has spare cots',
      {
        signal: 'availability',
        status: 'active',
        name: 'north shelter',
        surplus: 'cots',
        implicitQuestion: 'none',
      },
    ],
  ])('preserves typed workcenter prefill facts for "%s"', async (text, extractedFacts) => {
    const ai = createAi({
      response: {
        intent: 'workcenter',
        confidence: 0.93,
        reason: 'The user is describing a work center.',
        extractedFacts,
      },
    });

    await expect(classifyTelegramIntent({ ai, text })).resolves.toMatchObject({
      intent: 'workcenter',
      confidence: 0.93,
      extractedFacts,
    });
  });

  it('returns family_reunification for valid missing-person output', async () => {
    const ai = createAi({
      response: {
        intent: 'family_reunification',
        confidence: 0.96,
        reason: 'The user is looking for a missing child.',
        extractedFacts: { caseType: 'missing_person', subjectType: 'child' },
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

  it('keeps low-confidence resource classifications ambiguous instead of overriding the global threshold', async () => {
    const ai = createAi({
      response: {
        intent: 'resource',
        confidence: 0.62,
        reason: 'The text mentions water but asks an unclear follow-up.',
        extractedFacts: {
          resourceDirection: 'offer',
          resourceType: 'water',
          resourceLabel: 'agua potable',
          implicitQuestion: 'where_needed',
        },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Agua?', confidenceThreshold: 0.75 })).resolves.toMatchObject({
      intent: 'ambiguous',
      confidence: 0.62,
      extractedFacts: { proposedIntent: 'resource' },
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
        ai: createAi({
          response: {
            intent: 'resource',
            confidence: 0.9,
            reason: 'The user is offering water.',
            extractedFacts: { resourceType: undefined },
          },
        }),
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
