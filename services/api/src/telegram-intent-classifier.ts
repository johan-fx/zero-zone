import {
  TelegramDispatchIntentFactsSchema,
  TelegramFamilyReunificationIntentFactsSchema,
  TelegramIncidentJoinIntentFactsSchema,
  TelegramIntentClassificationSchema,
  telegramDispatchActions,
  telegramDispatchFactSignals,
  telegramFamilyReunificationActions,
  telegramFamilyReunificationRelationshipHints,
  telegramFamilyReunificationUrgencyHints,
  telegramIncidentJoinFactSignals,
  telegramResourceFactDirections,
  telegramResourceFactTypes,
  telegramResourceImplicitQuestions,
  telegramWorkCenterFactSignals,
  dispatchTaskStatuses,
  incidentRoles,
  supportedLocales,
  sosSeverities,
  workCenterPriorities,
  workCenterStatuses,
  type TelegramIntentClassification,
} from '@zona-cero/contracts';

export const DEFAULT_TELEGRAM_INTENT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
export const DEFAULT_TELEGRAM_INTENT_CONFIDENCE_THRESHOLD = 0.75;

const telegramIntentActionValues = [
  ...telegramFamilyReunificationActions.filter((action) => action !== 'unknown'),
  ...telegramDispatchActions,
] as const;

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
        statusCandidate: {
          type: 'string',
          enum: dispatchTaskStatuses,
          description: 'For dispatch only: candidate task status when explicitly stated; must be one canonical dispatch status.',
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
        action: {
          type: 'string',
          enum: telegramIntentActionValues,
          description: 'For family_reunification route as search/report/info/unknown; for dispatch route as create/update/coordinate/unknown. Candidate only, never an operation.',
        },
        relationshipHint: {
          type: 'string',
          enum: telegramFamilyReunificationRelationshipHints,
          description: 'For family_reunification only: non-identifying relationship category, if clear.',
        },
        urgencyHint: {
          type: 'string',
          enum: telegramFamilyReunificationUrgencyHints,
          description: 'For family_reunification only: broad urgency category, if clear.',
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
        taskHint: {
          type: 'string',
          maxLength: 160,
          description: 'For dispatch only: short task label or persisted-task matching hint if stated. Never output free text as an ID.',
        },
        incidentHint: {
          type: 'string',
          maxLength: 100,
          description: 'For incident_join only: short incident id or label if stated.',
        },
        desiredRole: {
          type: 'string',
          enum: incidentRoles,
          description: 'For incident_join only: requested incident role candidate if explicitly stated. Candidate only; never grant permissions or join automatically.',
        },
        displayNameHint: {
          type: 'string',
          maxLength: 120,
          description: 'For incident_join only: short display name or pseudonym candidate if explicitly stated.',
        },
        localeHint: {
          type: 'string',
          enum: supportedLocales,
          description: 'For incident_join only: preferred locale candidate if explicitly stated.',
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

  const deterministicDispatchClassification = createDeterministicDispatchClassification(trimmedText);
  if (deterministicDispatchClassification) return deterministicDispatchClassification;

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

    const sanitizedPayload = sanitizeTelegramIntentClassificationPayload(parsedPayload.value);
    const parsedClassification = TelegramIntentClassificationSchema.safeParse(sanitizedPayload);
    if (!parsedClassification.success) {
      return createSafeIntentClassification('unknown', 0, 'Workers AI returned an invalid Telegram intent schema.');
    }
    if (!hasValidIntentSpecificFacts(parsedClassification.data)) {
      return createSafeIntentClassification('unknown', 0, 'Workers AI returned invalid intent-specific Telegram facts.');
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

function createDeterministicDispatchClassification(text: string): TelegramIntentClassification | null {
  const normalizedText = normalizeOperationalText(text);
  const routeCue = findDispatchRouteCue(normalizedText);
  if (!routeCue) return null;

  const status = findDispatchStatusCandidate(normalizedText);
  const action = status ? 'update' : findDispatchAction(normalizedText);
  const destinationHint = findDispatchDestinationHint(normalizedText);
  const category = findDispatchCategory(normalizedText);
  const taskHint = findDispatchTaskHint(normalizedText);

  const hasClearCreateOrCoordinationCue = (action === 'create' || action === 'coordinate') && Boolean(category || destinationHint);
  if (!status && !hasClearCreateOrCoordinationCue) return null;

  const parsedFacts = TelegramDispatchIntentFactsSchema.safeParse({
    signal: status ? (status === 'cancelled' ? 'cancel' : 'status_update') : findDispatchSignal(normalizedText, action),
    action,
    ...(status ? { statusCandidate: status, status } : {}),
    ...(category ? { category } : {}),
    ...(destinationHint ? { destinationHint } : {}),
    ...(taskHint ? { taskHint } : {}),
  });

  if (!parsedFacts.success) return null;

  return createSafeIntentClassification('dispatch', status ? 0.92 : 0.86, 'Deterministic dispatch routing cue detected.', parsedFacts.data);
}

function normalizeOperationalText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDispatchRouteCue(text: string): boolean {
  return /\b(?:dispatch|despacho|logistica|logistico|logistica|tarea|entrega|mision|reparto)\b/.test(text);
}

function findDispatchStatusCandidate(text: string): (typeof dispatchTaskStatuses)[number] | undefined {
  if (/\b(?:en camino|on the way|en ruta|enroute|en-route)\b/.test(text)) return 'en_route';
  if (/\b(?:accepted|aceptad[oa]s?|asignad[oa]s?)\b/.test(text)) return 'accepted';
  if (/\b(?:delivered|entregad[oa]s?)\b/.test(text)) return 'delivered';
  if (/\b(?:cancelled|canceled|cancelad[oa]s?|anulad[oa]s?)\b/.test(text)) return 'cancelled';
  if (/\b(?:pending|pendiente)s?\b/.test(text)) return 'pending';
  return undefined;
}

function findDispatchAction(text: string): 'create' | 'update' | 'coordinate' | 'unknown' {
  if (/\b(?:crea|crear|create|new|nueva|nuevo|abre|abrir)\b/.test(text)) return 'create';
  if (/\b(?:actualiza|actualizar|marca|marcar|mark|update|cambia|cambiar)\b/.test(text)) return 'update';
  if (/\b(?:coordina|coordinar|coordinate|asigna|asignar|assign|despacha|despachar)\b/.test(text)) return 'coordinate';
  return 'unknown';
}

function findDispatchSignal(text: string, action: 'create' | 'update' | 'coordinate' | 'unknown'): 'assignment' | 'logistics_request' | 'unknown' {
  if (action === 'create' || /\b(?:asigna|asignar|assign)\b/.test(text)) return 'assignment';
  if (action === 'coordinate' || /\b(?:logistica|logistico|despacho|entrega|reparto)\b/.test(text)) return 'logistics_request';
  return 'unknown';
}

function findDispatchCategory(text: string): string | undefined {
  const categoryPatterns: Array<[RegExp, string]> = [
    [/\b(?:agua|water)\b/, 'agua'],
    [/\b(?:comida|alimentos?|food)\b/, 'comida'],
    [/\b(?:medicin[ao]s?|medicamentos?|medicine)\b/, 'medicina'],
    [/\b(?:ambulancias?|ambulances?)\b/, 'ambulancia'],
    [/\b(?:mantas?|blankets?)\b/, 'mantas'],
    [/\b(?:combustible|fuel)\b/, 'combustible'],
    [/\b(?:transporte|transport)\b/, 'transporte'],
  ];

  return categoryPatterns.find(([pattern]) => pattern.test(text))?.[1];
}

function findDispatchDestinationHint(text: string): string | undefined {
  const destinationMatch = text.match(/\b(?:hacia|destino(?: a)?|al|a la|a el)\s+(?:el\s+|la\s+)?([a-z0-9][a-z0-9 -]{2,80})/);
  if (!destinationMatch?.[1]) return undefined;

  return cleanDispatchHint(destinationMatch[1].replace(/\b(?:para|con|como|estado|status)\b.*$/, ''));
}

function findDispatchTaskHint(text: string): string | undefined {
  const taskMatch =
    text.match(/\b((?:tarea|entrega|mision|reparto)\s+(?:de|del|de la|para)?\s*[a-z0-9 -]{1,80})/) ??
    text.match(/\b((?:despacho|dispatch)\s+(?:de|del|de la|para)?\s*[a-z0-9 -]{1,80})/);
  if (!taskMatch?.[1]) return undefined;

  return cleanDispatchHint(taskMatch[1].replace(/\b(?:hacia|destino|al|a la|a el|con|como|esta|status)\b.*$/, ''));
}

function cleanDispatchHint(value: string): string | undefined {
  const cleaned = value.replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : undefined;
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
    'Map creating, coordinating, assigning, updating, or cancelling dispatch/logistics tasks or mission updates to dispatch.',
    'Map joining/selecting an incident or onboarding into an incident to incident_join.',
    'Use ambiguous when more than one operational intent is plausible. Use unknown when no operational route is clear.',
    'Extract facts only when clear. Facts are candidates for backend validation and user confirmation, not commands.',
    'For resource: resourceDirection, resourceType, resourceLabel, quantityApprox, locationHint, implicitQuestion.',
    'For workcenter: signal, status, name, locationHint, priority, initialNeed, surplus, implicitQuestion. Never geocode locationHint or output coordinates.',
    'Workcenter examples ES: "hay un puesto médico en la escuela con prioridad alta y necesitan medicamentos" => intent workcenter, signal availability, name "puesto médico", locationHint "escuela", priority high, initialNeed "medicamentos".',
    'Workcenter examples EN: "north shelter is active and needs blankets" => intent workcenter, status active, name "north shelter", initialNeed "blankets".',
    'Workcenter examples ES: "el centro norte está lleno" => intent workcenter, signal capacity, name "centro norte". Example EN: "north shelter has spare cots" => intent workcenter, signal availability, name "north shelter", surplus "cots".',
    'For family_reunification: ONLY action, relationshipHint, urgencyHint. Never extract names, ages, clothing, phone numbers, exact locations, subject descriptions, caseType, subjectType, or locationHint.',
    'Family reunification examples ES: "busco a mi hijo desaparecido" => intent family_reunification, action search, relationshipHint parent, urgencyHint normal. Example EN: "I need family reunification help" => intent family_reunification, action info.',
    'If a family_reunification message includes a name, age, clothing, phone, or location, classify the intent but discard those details from extractedFacts and route to the private secure flow.',
    'For sos: severity, locationHint, medicalNeed, peopleCount, hazardHint. These are candidate facts only; never create an SOS, geocode, output coordinates, copy raw user text, or include PII.',
    'SOS examples ES: "necesito ayuda médica urgente en el refugio norte, somos 3 y hay humo" => intent sos, severity medical, locationHint "refugio norte", medicalNeed "ayuda médica urgente", peopleCount 3, hazardHint "humo".',
    'SOS examples ES: "hay dos personas atrapadas en la escalera este" => intent sos, severity trapped, peopleCount 2, locationHint "escalera este". Example EN: "urgent medical help at east stairs" => intent sos, severity medical, medicalNeed "urgent medical help", locationHint "east stairs".',
    'For dispatch: signal, action, category, quantityApprox, destinationHint, taskHint, statusCandidate, and legacy status. These are candidates only; never create, update, assign, resolve, rank, or mutate dispatch tasks from LLM output.',
    'Dispatch action semantics: create for new dispatch task candidates, update for status changes to existing tasks, coordinate for assignment/logistics coordination, unknown when unclear.',
    'Dispatch statusCandidate and legacy status must be exactly one canonical dispatch status: pending, accepted, en_route, delivered, or cancelled. If the text says "done", "finished", or another non-canonical status, do not invent a status.',
    'Dispatch examples ES: "coordina 2 ambulancias al refugio norte" => intent dispatch, signal logistics_request, action coordinate, category "ambulancias", quantityApprox "2", destinationHint "refugio norte".',
    'Dispatch examples EN: "create a water delivery for north gate, 10 boxes" => intent dispatch, signal assignment, action create, category "water", quantityApprox "10 boxes", destinationHint "north gate".',
    'Dispatch update examples ES: "marca la entrega del almacén como en camino" => intent dispatch, signal status_update, action update, taskHint "entrega del almacén", statusCandidate en_route. Example EN: "mark north gate delivery delivered" => intent dispatch, signal status_update, action update, taskHint "north gate delivery", statusCandidate delivered.',
    'For incident_join: signal, incidentHint, desiredRole, displayNameHint, localeHint. desiredRole is candidate-only; never grant permissions, never call joinIncident, and never join automatically from classification.',
    'Incident join examples ES: "quiero unirme al incidente demo como voluntario" => intent incident_join, signal request_join, incidentHint "demo", desiredRole volunteer. Example EN: "switch me to incident north" => intent incident_join, signal change_incident, incidentHint "north".',
    'Resource directions: "tengo", "puedo llevar", "me sobra", "tenemos para entregar" => offer; "necesito", "necesitamos", "hace falta" => need.',
    'Resource examples: "tengo agua potable, dónde la necesitan?" => intent resource, resourceDirection offer, resourceType water, resourceLabel "agua potable", implicitQuestion where_needed.',
    'Resource examples: "puedo llevar comida" => intent resource, resourceDirection offer, resourceType food.',
    'Resource examples: "me sobra medicina" => intent resource, resourceDirection offer, resourceType medicine.',
    'Resource examples: "necesitamos mantas" => intent resource, resourceDirection need, resourceType shelter or equipment or other as best supported by the text.',
    'Keep extractedFacts small, precise, and JSON-compatible. Do not include actions to execute, raw user text, phone numbers, exact coordinates, names, or other PII.',
  ].join('\n');
}

function sanitizeTelegramIntentClassificationPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const record = value as Record<string, unknown>;
  if (record.intent === 'family_reunification') {
    return {
      intent: record.intent,
      confidence: record.confidence,
      reason: 'Family reunification route detected; sensitive details discarded.',
      extractedFacts: sanitizeTelegramFamilyReunificationFacts(record.extractedFacts),
    };
  }

  if (record.intent === 'incident_join') {
    return {
      intent: record.intent,
      confidence: record.confidence,
      reason: record.reason,
      extractedFacts: sanitizeTelegramIncidentJoinFacts(record.extractedFacts),
    };
  }

  return value;
}

function sanitizeTelegramFamilyReunificationFacts(value: unknown): TelegramIntentClassification['extractedFacts'] {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const sanitized: Record<string, unknown> = {};

  if (isStringIn(source.action, telegramFamilyReunificationActions)) sanitized.action = source.action;
  if (isStringIn(source.relationshipHint, telegramFamilyReunificationRelationshipHints)) sanitized.relationshipHint = source.relationshipHint;
  if (isStringIn(source.urgencyHint, telegramFamilyReunificationUrgencyHints)) sanitized.urgencyHint = source.urgencyHint;

  return TelegramFamilyReunificationIntentFactsSchema.parse(sanitized);
}

function sanitizeTelegramIncidentJoinFacts(value: unknown): TelegramIntentClassification['extractedFacts'] {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const sanitized: Record<string, unknown> = {};

  if (isStringIn(source.signal, telegramIncidentJoinFactSignals)) sanitized.signal = source.signal;
  if (typeof source.incidentHint === 'string' && source.incidentHint.trim().length > 0 && source.incidentHint.trim().length <= 100) {
    sanitized.incidentHint = source.incidentHint.trim();
  }

  const desiredRoleSource = source.desiredRole ?? source.roleHint;
  if (desiredRoleSource !== undefined) {
    sanitized.desiredRole = desiredRoleSource;
  }

  if (typeof source.displayNameHint === 'string' && source.displayNameHint.trim().length > 0 && source.displayNameHint.trim().length <= 120) {
    sanitized.displayNameHint = source.displayNameHint.trim();
  }

  if (source.localeHint !== undefined) {
    sanitized.localeHint = source.localeHint;
  }

  return TelegramIncidentJoinIntentFactsSchema.parse(sanitized);
}

function hasValidIntentSpecificFacts(classification: TelegramIntentClassification): boolean {
  if (classification.intent === 'dispatch') {
    return TelegramDispatchIntentFactsSchema.safeParse(classification.extractedFacts).success;
  }
  if (classification.intent === 'incident_join') {
    return TelegramIncidentJoinIntentFactsSchema.safeParse(classification.extractedFacts).success;
  }
  return true;
}

function isStringIn<const T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && allowed.includes(value as T[number]);
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
