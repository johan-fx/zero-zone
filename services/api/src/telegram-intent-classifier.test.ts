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
    expect(messages[0]?.content).toContain('For family_reunification: ONLY action, relationshipHint, urgencyHint');
    expect(messages[0]?.content).toContain('classify the intent but discard those details from extractedFacts');
    expect(messages[0]?.content).toContain('"necesito ayuda médica urgente en el refugio norte, somos 3 y hay humo" => intent sos');
    expect(messages[0]?.content).toContain('facts only; never create an SOS, geocode, output coordinates, copy raw user text, or include PII');
    expect(messages[0]?.content).toContain('"hay dos personas atrapadas en la escalera este" => intent sos');
    expect(messages[0]?.content).toContain('"coordina 2 ambulancias al refugio norte" => intent dispatch');
    expect(messages[0]?.content).toContain('"create a water delivery for north gate, 10 boxes" => intent dispatch');
    expect(messages[0]?.content).toContain('"marca la entrega del almacén como en camino" => intent dispatch');
    expect(messages[0]?.content).toContain('never create, update, assign, resolve, rank, or mutate dispatch tasks from LLM output');
    expect(messages[0]?.content).toContain('statusCandidate and legacy status must be exactly one canonical dispatch status');
    expect(messages[0]?.content).toContain('For incident_join: signal, incidentHint, desiredRole, displayNameHint, localeHint');
    expect(messages[0]?.content).toContain('desiredRole is candidate-only; never grant permissions');
    expect(messages[0]?.content).toContain('never call joinIncident, and never join automatically');
    expect(messages[0]?.content).toContain('"quiero unirme al incidente demo como voluntario" => intent incident_join');
    expect(messages[0]?.content).toContain('Do not include actions to execute, raw user text, phone numbers, exact coordinates, names, or other PII');
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
              statusCandidate: expect.objectContaining({ enum: ['pending', 'accepted', 'en_route', 'delivered', 'cancelled'] }),
              name: expect.objectContaining({ type: 'string' }),
              priority: expect.objectContaining({ enum: ['low', 'medium', 'high', 'critical'] }),
              initialNeed: expect.objectContaining({ type: 'string' }),
              surplus: expect.objectContaining({ type: 'string' }),
              action: expect.objectContaining({ enum: expect.arrayContaining(['search', 'report', 'info', 'create', 'update', 'coordinate', 'unknown']) }),
              relationshipHint: expect.objectContaining({ enum: ['parent', 'child', 'sibling', 'partner', 'relative', 'guardian', 'unknown'] }),
              urgencyHint: expect.objectContaining({ enum: ['urgent', 'normal', 'unknown'] }),
              severity: expect.objectContaining({ enum: ['critical', 'medical', 'security', 'trapped', 'other'] }),
              medicalNeed: expect.objectContaining({ type: 'string' }),
              peopleCount: expect.objectContaining({ type: 'integer' }),
              hazardHint: expect.objectContaining({ type: 'string' }),
              destinationHint: expect.objectContaining({ type: 'string' }),
              taskHint: expect.objectContaining({ type: 'string' }),
              incidentHint: expect.objectContaining({ type: 'string' }),
              desiredRole: expect.objectContaining({ enum: ['volunteer', 'coordinator', 'logistics', 'medical'] }),
              displayNameHint: expect.objectContaining({ type: 'string' }),
              localeHint: expect.objectContaining({ enum: ['es', 'en'] }),
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

  it('preserves typed SOS candidate facts without treating them as commands', async () => {
    const ai = createAi({
      response: {
        intent: 'sos',
        confidence: 0.97,
        reason: 'The user needs urgent medical help.',
        extractedFacts: {
          severity: 'medical',
          locationHint: 'refugio norte',
          medicalNeed: 'ayuda médica urgente',
          peopleCount: 3,
          hazardHint: 'humo',
        },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'necesito ayuda médica urgente en el refugio norte, somos 3 y hay humo' })).resolves.toMatchObject({
      intent: 'sos',
      confidence: 0.97,
      extractedFacts: {
        severity: 'medical',
        locationHint: 'refugio norte',
        medicalNeed: 'ayuda médica urgente',
        peopleCount: 3,
        hazardHint: 'humo',
      },
    });
  });

  it('preserves typed dispatch create and coordination candidate facts without treating them as commands', async () => {
    const ai = createAi({
      response: {
        intent: 'dispatch',
        confidence: 0.94,
        reason: 'The user is coordinating a logistics dispatch.',
        extractedFacts: {
          signal: 'logistics_request',
          action: 'coordinate',
          category: 'ambulances',
          quantityApprox: '2',
          destinationHint: 'north shelter',
        },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Coordinate 2 ambulances to north shelter' })).resolves.toMatchObject({
      intent: 'dispatch',
      confidence: 0.94,
      extractedFacts: {
        signal: 'logistics_request',
        action: 'coordinate',
        category: 'ambulances',
        quantityApprox: '2',
        destinationHint: 'north shelter',
      },
    });
  });

  it('preserves typed dispatch status update candidates only for canonical statuses', async () => {
    const ai = createAi({
      response: {
        intent: 'dispatch',
        confidence: 0.95,
        reason: 'The user is updating an existing dispatch task.',
        extractedFacts: {
          signal: 'status_update',
          action: 'update',
          taskHint: 'north gate delivery',
          statusCandidate: 'delivered',
          status: 'delivered',
        },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Mark north gate delivery delivered' })).resolves.toMatchObject({
      intent: 'dispatch',
      confidence: 0.95,
      extractedFacts: {
        signal: 'status_update',
        action: 'update',
        taskHint: 'north gate delivery',
        statusCandidate: 'delivered',
        status: 'delivered',
      },
    });
  });

  it('deterministically routes clear Spanish dispatch status updates before Workers AI', async () => {
    const ai = createAi({
      response: {
        intent: 'unknown',
        confidence: 0,
        extractedFacts: {},
      },
    });

    await expect(
      classifyTelegramIntent({
        ai,
        text: 'El equipo de despacho está en camino para la tarea de agua hacia el centro norte.',
      }),
    ).resolves.toMatchObject({
      intent: 'dispatch',
      confidence: 0.92,
      extractedFacts: {
        signal: 'status_update',
        action: 'update',
        statusCandidate: 'en_route',
        status: 'en_route',
        category: 'agua',
        destinationHint: 'centro norte',
        taskHint: 'tarea de agua',
      },
    });
    expect(ai.run).not.toHaveBeenCalled();
  });

  it.each([
    'El equipo de despacho está en camino para la tarea de aguacate hacia el centro norte.',
    'El equipo de despacho está en camino para la tarea de comidista hacia el centro norte.',
    'El equipo de despacho está en camino para la tarea de premedicamento hacia el centro norte.',
  ])('does not derive dispatch category from partial word match in "%s"', async (text) => {
    const ai = createAi({
      response: {
        intent: 'unknown',
        confidence: 0,
        extractedFacts: {},
      },
    });

    const result = await classifyTelegramIntent({ ai, text });

    expect(result).toMatchObject({
      intent: 'dispatch',
      confidence: 0.92,
      extractedFacts: {
        signal: 'status_update',
        action: 'update',
        statusCandidate: 'en_route',
        status: 'en_route',
      },
    });
    expect(result.extractedFacts).not.toHaveProperty('category');
    expect(ai.run).not.toHaveBeenCalled();
  });

  it('does not deterministically capture generic resource messages as dispatch', async () => {
    const ai = createAi({
      response: {
        intent: 'resource',
        confidence: 0.91,
        reason: 'The user is offering water.',
        extractedFacts: {
          resourceDirection: 'offer',
          resourceType: 'water',
          resourceLabel: 'agua',
        },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'tengo agua' })).resolves.toMatchObject({
      intent: 'resource',
      confidence: 0.91,
      extractedFacts: {
        resourceDirection: 'offer',
        resourceType: 'water',
        resourceLabel: 'agua',
      },
    });
    expect(ai.run).toHaveBeenCalled();
  });

  it('preserves incident join facts as candidate-only desiredRole context', async () => {
    const ai = createAi({
      response: {
        intent: 'incident_join',
        confidence: 0.94,
        reason: 'The user wants to join an incident.',
        extractedFacts: {
          signal: 'request_join',
          incidentHint: 'incident-zc-demo',
          desiredRole: 'volunteer',
          displayNameHint: 'Radio 12',
          localeHint: 'es',
        },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Quiero unirme al incidente demo como voluntario, soy Radio 12' })).resolves.toMatchObject({
      intent: 'incident_join',
      confidence: 0.94,
      extractedFacts: {
        signal: 'request_join',
        incidentHint: 'incident-zc-demo',
        desiredRole: 'volunteer',
        displayNameHint: 'Radio 12',
        localeHint: 'es',
      },
    });
  });

  it('migrates legacy incident join roleHint to desiredRole without exposing roleHint', async () => {
    const ai = createAi({
      response: {
        intent: 'incident_join',
        confidence: 0.93,
        extractedFacts: {
          signal: 'request_join',
          incidentHint: 'demo',
          roleHint: 'volunteer',
        },
      },
    });

    const result = await classifyTelegramIntent({ ai, text: 'quiero unirme al incidente demo como voluntario' });

    expect(result).toMatchObject({
      intent: 'incident_join',
      extractedFacts: {
        signal: 'request_join',
        incidentHint: 'demo',
        desiredRole: 'volunteer',
      },
    });
    expect(result.extractedFacts).not.toHaveProperty('roleHint');
  });

  it('drops invalid incident join optional enums while preserving safe hints', async () => {
    const ai = createAi({
      response: {
        intent: 'incident_join',
        confidence: 0.96,
        reason: 'The user wants elevated access.',
        extractedFacts: {
          signal: 'request_join',
          incidentHint: 'demo',
          desiredRole: 'admin',
          localeHint: 'ca',
        },
      },
    });

    const result = await classifyTelegramIntent({ ai, text: 'join demo as admin' });

    expect(result).toMatchObject({
      intent: 'incident_join',
      confidence: 0.96,
      extractedFacts: {
        signal: 'request_join',
        incidentHint: 'demo',
      },
    });
    expect(result.extractedFacts).not.toHaveProperty('desiredRole');
    expect(result.extractedFacts).not.toHaveProperty('localeHint');
  });

  it('rejects dispatch status candidates outside the canonical contract', async () => {
    const ai = createAi({
      response: {
        intent: 'dispatch',
        confidence: 0.96,
        reason: 'The user is updating a dispatch task.',
        extractedFacts: {
          signal: 'status_update',
          action: 'update',
          taskHint: 'north gate delivery',
          statusCandidate: 'done',
        },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Mark north gate delivery done' })).resolves.toMatchObject({
      intent: 'unknown',
      confidence: 0,
      extractedFacts: {},
    });
  });

  it('returns family_reunification for valid missing-person output', async () => {
    const ai = createAi({
      response: {
        intent: 'family_reunification',
        confidence: 0.96,
        reason: 'The user is looking for a missing child.',
        extractedFacts: { action: 'search', relationshipHint: 'parent', urgencyHint: 'normal' },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Busco a mi hija desaparecida' })).resolves.toMatchObject({
      intent: 'family_reunification',
      confidence: 0.96,
      extractedFacts: { action: 'search', relationshipHint: 'parent', urgencyHint: 'normal' },
    });
  });

  it('sanitizes family reunification facts returned with synthetic PII', async () => {
    const ai = createAi({
      response: {
        intent: 'family_reunification',
        confidence: 0.97,
        reason: 'Looking for Lucia, age 8, red jacket, call +34 600 000 000 near north gate.',
        rawText: 'Busco a Lucia de 8 años con chaqueta roja cerca de north gate, llamad +34 600 000 000.',
        extractedFacts: {
          action: 'search',
          relationshipHint: 'parent',
          urgencyHint: 'urgent',
          fullName: 'Lucia Example',
          age: 8,
          clothing: 'red jacket',
          phone: '+34 600 000 000',
          locationHint: 'north gate',
          caseType: 'missing_person',
          subjectType: 'child',
        },
      },
    });

    await expect(
      classifyTelegramIntent({
        ai,
        text: 'Busco a Lucia de 8 años con chaqueta roja cerca de north gate, llamad +34 600 000 000.',
      }),
    ).resolves.toEqual({
      intent: 'family_reunification',
      confidence: 0.97,
      reason: 'Family reunification route detected; sensitive details discarded.',
      extractedFacts: { action: 'search', relationshipHint: 'parent', urgencyHint: 'urgent' },
    });
  });

  it('routes family reunification while discarding legacy or unsafe AI fields', async () => {
    const ai = createAi({
      response: {
        intent: 'family_reunification',
        confidence: 0.95,
        extractedFacts: {
          caseType: 'found_person',
          subjectType: 'child',
          locationHint: 'gate 2',
          fullName: 'Private Name',
          phone: '+34 600 000 000',
        },
      },
    });

    await expect(classifyTelegramIntent({ ai, text: 'Encontré a una menor cerca de gate 2' })).resolves.toMatchObject({
      intent: 'family_reunification',
      confidence: 0.95,
      extractedFacts: { action: 'unknown' },
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
