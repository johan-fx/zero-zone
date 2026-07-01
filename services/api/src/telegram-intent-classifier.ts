import { TelegramIntentClassificationSchema, type TelegramIntentClassification } from '@zona-cero/contracts';

export const DEFAULT_TELEGRAM_INTENT_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
export const DEFAULT_TELEGRAM_INTENT_CONFIDENCE_THRESHOLD = 0.75;

const TELEGRAM_INTENT_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    intent: {
      type: 'string',
      enum: ['resource', 'workcenter', 'family_reunification', 'sos', 'dispatch', 'incident_join', 'unknown', 'ambiguous'],
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    reason: {
      type: 'string',
      maxLength: 500,
    },
    extractedFacts: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['intent', 'confidence', 'extractedFacts'],
} as const;

export type TelegramIntentAiBinding = {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
};

export type TelegramIntentRouterEnv = {
  TELEGRAM_INTENT_ROUTER_ENABLED?: string;
  TELEGRAM_INTENT_MODEL?: string;
  TELEGRAM_INTENT_CONFIDENCE_THRESHOLD?: string;
};

export type TelegramIntentClassificationContext = {
  locale?: string;
  incidentId?: string;
  activeFlow?: string;
  command?: string | null;
  messageType?: string;
};

export type ClassifyTelegramIntentInput = {
  ai: TelegramIntentAiBinding;
  text: string;
  context?: TelegramIntentClassificationContext;
  model?: string;
  confidenceThreshold?: number;
};

export type TelegramIntentRouterConfig = {
  enabled: boolean;
  model: string;
  confidenceThreshold: number;
};

export function resolveTelegramIntentRouterConfig(env: TelegramIntentRouterEnv): TelegramIntentRouterConfig {
  return {
    enabled: parseEnabledFlag(env.TELEGRAM_INTENT_ROUTER_ENABLED),
    model: env.TELEGRAM_INTENT_MODEL?.trim() || DEFAULT_TELEGRAM_INTENT_MODEL,
    confidenceThreshold: parseConfidenceThreshold(env.TELEGRAM_INTENT_CONFIDENCE_THRESHOLD),
  };
}

export async function classifyTelegramIntent({
  ai,
  text,
  context,
  model = DEFAULT_TELEGRAM_INTENT_MODEL,
  confidenceThreshold = DEFAULT_TELEGRAM_INTENT_CONFIDENCE_THRESHOLD,
}: ClassifyTelegramIntentInput): Promise<TelegramIntentClassification> {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return createSafeIntentClassification('unknown', 0, 'Empty Telegram message.');
  }

  try {
    const response = await ai.run(model, {
      messages: [
        {
          role: 'system',
          content: buildTelegramIntentSystemPrompt(),
        },
        {
          role: 'user',
          content: JSON.stringify({ text: trimmedText, context: context ?? {} }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: TELEGRAM_INTENT_RESPONSE_SCHEMA,
      },
      temperature: 0,
      max_tokens: 160,
    });

    const parsedPayload = parseAiJsonPayload(response);
    if (!parsedPayload.success) {
      return createSafeIntentClassification('unknown', 0, parsedPayload.reason);
    }

    const parsedClassification = TelegramIntentClassificationSchema.safeParse(parsedPayload.value);
    if (!parsedClassification.success) {
      return createSafeIntentClassification('unknown', 0, 'Workers AI returned an invalid Telegram intent schema.');
    }

    if (parsedClassification.data.confidence < confidenceThreshold && parsedClassification.data.intent !== 'unknown') {
      return createSafeIntentClassification('ambiguous', parsedClassification.data.confidence, 'Classification below confidence threshold.', {
        proposedIntent: parsedClassification.data.intent,
      });
    }

    return parsedClassification.data;
  } catch {
    return createSafeIntentClassification('unknown', 0, 'Workers AI intent classification failed.');
  }
}

function buildTelegramIntentSystemPrompt(): string {
  return [
    'You classify Spanish Telegram disaster-response messages for routing only. You never execute business operations.',
    'Return only JSON matching the schema. No Markdown, no prose outside JSON.',
    'Allowed intents: resource, workcenter, family_reunification, sos, dispatch, incident_join, unknown, ambiguous.',
    'Map offers, needs, or reports of supplies, potable water, food, medicine, shelter, transport, fuel, or equipment to resource.',
    'Map missing child, missing person, lost family member, found child/person, or search/reunification requests to family_reunification.',
    'Map volunteer center status, capacity, damage, location, or availability to workcenter.',
    'Map immediate danger, injury, trapped person, urgent help, or life-safety emergency to sos.',
    'Map task assignment, task status, logistics dispatch, or mission updates to dispatch.',
    'Map joining/selecting an incident or onboarding into an incident to incident_join.',
    'Use ambiguous when more than one operational intent is plausible. Use unknown when no operational route is clear.',
    'Examples: "tenemos agua potable para entregar" => resource; "busco a mi hijo desaparecido" => family_reunification.',
    'Keep extractedFacts small and JSON-compatible. Do not include actions to execute.',
  ].join('\n');
}

function parseEnabledFlag(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'on', 'yes', 'enabled'].includes(value.trim().toLowerCase());
}

function parseConfidenceThreshold(value: string | undefined): number {
  if (!value) return DEFAULT_TELEGRAM_INTENT_CONFIDENCE_THRESHOLD;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_TELEGRAM_INTENT_CONFIDENCE_THRESHOLD;
  }

  return parsed;
}

type ParseAiJsonPayloadResult = { success: true; value: unknown } | { success: false; reason: string };

function parseAiJsonPayload(response: unknown): ParseAiJsonPayloadResult {
  const candidate = extractAiResponseCandidate(response);

  if (candidate && typeof candidate === 'object') {
    return { success: true, value: candidate };
  }

  if (typeof candidate !== 'string') {
    return { success: false, reason: 'Workers AI response did not contain JSON content.' };
  }

  try {
    return { success: true, value: JSON.parse(candidate) };
  } catch {
    return { success: false, reason: 'Workers AI response was not valid JSON.' };
  }
}

function extractAiResponseCandidate(response: unknown): unknown {
  if (typeof response === 'string') return response;
  if (!response || typeof response !== 'object') return null;

  const record = response as Record<string, unknown>;
  if (record.response !== undefined) return record.response;

  const firstChoice = Array.isArray(record.choices) ? record.choices[0] : undefined;
  if (firstChoice && typeof firstChoice === 'object') {
    const choice = firstChoice as Record<string, unknown>;
    if (typeof choice.text === 'string') return choice.text;

    const message = choice.message;
    if (message && typeof message === 'object') {
      const content = (message as Record<string, unknown>).content;
      if (typeof content === 'string') return content;
    }
  }

  return response;
}

function createSafeIntentClassification(
  intent: TelegramIntentClassification['intent'],
  confidence: number,
  reason: string,
  extractedFacts: TelegramIntentClassification['extractedFacts'] = {},
): TelegramIntentClassification {
  return TelegramIntentClassificationSchema.parse({
    intent,
    confidence,
    reason,
    extractedFacts,
  });
}
