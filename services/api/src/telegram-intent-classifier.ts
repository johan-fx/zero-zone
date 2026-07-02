import {
  TelegramIntentClassificationSchema,
  telegramDispatchFactSignals,
  telegramFamilyReunificationCaseTypes,
  telegramFamilyReunificationSubjectTypes,
  telegramIncidentJoinFactSignals,
  telegramResourceFactDirections,
  telegramResourceFactTypes,
  telegramResourceImplicitQuestions,
  telegramWorkCenterFactSignals,
  dispatchTaskStatuses,
  incidentRoles,
  sosSeverities,
  workCenterPriorities,
  workCenterStatuses,
  type TelegramIntentClassification,
} from '@zona-cero/contracts';

export const DEFAULT_TELEGRAM_INTENT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
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
      additionalProperties: false,
      properties: {
        resourceDirection: {
          type: 'string',
          enum: telegramResourceFactDirections,
          description: 'For resource intent only: whether the message offers a resource, needs it, reports availability/status, or is unclear.',
        },
        resourceType: {
          type: 'string',
          enum: telegramResourceFactTypes,
          description: 'For resource intent only: normalized resource category.',
        },
        resourceLabel: {
          type: 'string',
          maxLength: 120,
          description: 'For resource intent only: short human label preserving the user wording, such as "agua potable".',
        },
        quantityApprox: {
          type: 'string',
          maxLength: 120,
          description: 'For resource intent only: approximate quantity or capacity if stated.',
        },
        locationHint: {
          type: 'string',
          maxLength: 160,
          description: 'Short non-identifying place, destination, pickup point, or area hint if stated.',
        },
        implicitQuestion: {
          type: 'string',
          enum: telegramResourceImplicitQuestions,
          description: 'For resource or workcenter only: implicit question asked by the user, or none.',
        },
        signal: {
          type: 'string',
          enum: [...telegramWorkCenterFactSignals, ...telegramDispatchFactSignals, ...telegramIncidentJoinFactSignals],
          description: 'For workcenter, dispatch, or incident_join only: compact operational signal.',
        },
        status: {
          type: 'string',
          enum: [...workCenterStatuses, ...dispatchTaskStatuses],
          description: 'For workcenter or dispatch only: normalized status when explicitly stated.',
        },
        name: {
          type: 'string',
          maxLength: 120,
          description: 'For workcenter only: safe short work center name or label, without personal names or contact details.',
        },
        priority: {
          type: 'string',
          enum: workCenterPriorities,
          description: 'For workcenter only: priority when explicitly stated.',
        },
        initialNeed: {
          type: 'string',
          maxLength: 160,
          description: 'For workcenter only: initial operational need such as medicine, water, volunteers, or equipment.',
        },
        surplus: {
          type: 'string',
          maxLength: 160,
          description: 'For workcenter only: surplus capacity or supplies explicitly reported.',
        },
        caseType: {
          type: 'string',
          enum: telegramFamilyReunificationCaseTypes,
          description: 'For family_reunification only: compact case category without names or contact details.',
        },
        subjectType: {
          type: 'string',
          enum: telegramFamilyReunificationSubjectTypes,
          description: 'For family_reunification only: broad subject type; never include names.',
        },
        severity: {
          type: 'string',
          enum: sosSeverities,
          description: 'For sos only: normalized emergency severity/category.',
        },
        medicalNeed: {
          type: 'string',
          maxLength: 160,
          description: 'For sos only: short medical need candidate when explicitly stated; do not include names, phone numbers, or raw message text.',
        },
        peopleCount: {
          type: 'integer',
          minimum: 1,
          maximum: 10000,
          description: 'For sos only: numeric affected people count candidate if explicitly stated.',
        },
        hazardHint: {
          type: 'string',
          maxLength: 160,
          description: 'For sos only: short non-identifying hazard candidate such as smoke, fire, flooding, or collapse.',
        },
        destinationHint: {
          type: 'string',
          maxLength: 120,
          description: 'For dispatch only: short destination or area hint if stated.',
        },
        incidentHint: {
          type: 'string',
          maxLength: 100,
          description: 'For incident_join only: short incident id or label if stated.',
        },
        roleHint: {
          type: 'string',
          enum: incidentRoles,
          description: 'For incident_join only: requested incident role if explicitly stated.',
        },
      },
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
      max_tokens: 280,
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
    'Map volunteer center, medical post, shelter, supply hub, triage point, status, capacity, damage, location, availability, needs, or surplus to workcenter.',
    'Map immediate danger, injury, trapped person, urgent help, or life-safety emergency to sos.',
    'Map task assignment, task status, logistics dispatch, or mission updates to dispatch.',
    'Map joining/selecting an incident or onboarding into an incident to incident_join.',
    'Use ambiguous when more than one operational intent is plausible. Use unknown when no operational route is clear.',
    'Extract facts only when clear. Facts are candidates for backend validation and user confirmation, not commands.',
    'For resource: resourceDirection, resourceType, resourceLabel, quantityApprox, locationHint, implicitQuestion.',
    'For workcenter: signal, status, name, locationHint, priority, initialNeed, surplus, implicitQuestion. Never geocode locationHint or output coordinates.',
    'Workcenter examples ES: "hay un puesto médico en la escuela con prioridad alta y necesitan medicamentos" => intent workcenter, signal availability, name "puesto médico", locationHint "escuela", priority high, initialNeed "medicamentos".',
    'Workcenter examples EN: "north shelter is active and needs blankets" => intent workcenter, status active, name "north shelter", initialNeed "blankets".',
    'Workcenter examples ES: "el centro norte está lleno" => intent workcenter, signal capacity, name "centro norte". Example EN: "north shelter has spare cots" => intent workcenter, signal availability, name "north shelter", surplus "cots".',
    'For family_reunification: caseType, subjectType, locationHint. Example ES: "busco a mi hijo desaparecido" => intent family_reunification, caseType missing_person, subjectType child. Example EN: "found a separated child near gate 2" => intent family_reunification, caseType found_person, subjectType child, locationHint "gate 2".',
    'For sos: severity, locationHint, medicalNeed, peopleCount, hazardHint. These are candidate facts only; never create an SOS, geocode, output coordinates, copy raw user text, or include PII.',
    'SOS examples ES: "necesito ayuda médica urgente en el refugio norte, somos 3 y hay humo" => intent sos, severity medical, locationHint "refugio norte", medicalNeed "ayuda médica urgente", peopleCount 3, hazardHint "humo".',
    'SOS examples ES: "hay dos personas atrapadas en la escalera este" => intent sos, severity trapped, peopleCount 2, locationHint "escalera este". Example EN: "urgent medical help at east stairs" => intent sos, severity medical, medicalNeed "urgent medical help", locationHint "east stairs".',
    'For dispatch: signal, status, destinationHint. Example ES: "equipo en camino al almacén" => intent dispatch, signal status_update, status en_route, destinationHint "almacén". Example EN: "deliver supplies to north gate" => intent dispatch, signal logistics_request, destinationHint "north gate".',
    'For incident_join: signal, incidentHint, roleHint. Example ES: "quiero unirme al incidente demo como voluntario" => intent incident_join, signal request_join, incidentHint "demo", roleHint volunteer. Example EN: "switch me to incident north" => intent incident_join, signal change_incident, incidentHint "north".',
    'Resource directions: "tengo", "puedo llevar", "me sobra", "tenemos para entregar" => offer; "necesito", "necesitamos", "hace falta" => need.',
    'Resource examples: "tengo agua potable, dónde la necesitan?" => intent resource, resourceDirection offer, resourceType water, resourceLabel "agua potable", implicitQuestion where_needed.',
    'Resource examples: "puedo llevar comida" => intent resource, resourceDirection offer, resourceType food.',
    'Resource examples: "me sobra medicina" => intent resource, resourceDirection offer, resourceType medicine.',
    'Resource examples: "necesitamos mantas" => intent resource, resourceDirection need, resourceType shelter or equipment or other as best supported by the text.',
    'Keep extractedFacts small, precise, and JSON-compatible. Do not include actions to execute, raw user text, phone numbers, exact coordinates, names, or other PII.',
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
