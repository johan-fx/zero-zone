import { describe, expect, it, vi } from 'vitest';

import {
  incidentConfigHappyFixture,
  incidentListHappyFixture,
  privateFamilyReunificationIssueResponseFixture,
  sosAlertCreateResponseHappyFixture,
  telegramIncidentJoinResponseFixture,
  telegramStartUpdateFixture,
  telegramWorkCenterCreateRequestFixture,
  validWorkCenterCreatePayloadFixture,
  workCenterCreateResponseHappyFixture,
} from '@zona-cero/testing';
import {
  DispatchTaskConnectedUpdateRequestSchema,
  PrivateWebLinkIssueRequestSchema,
  ResourceReportConnectedCreateRequestSchema,
  SosConnectedCreateRequestSchema,
  WorkCenterConnectedCreateRequestSchema,
  type WorkCenterConnectedCreateRequest,
  type WorkCenterCreateResponse,
  type DispatchTask,
  type DispatchTaskResponse,
  type ResourceReportCreateResponse,
  type SyncFreshness,
} from '@zona-cero/contracts';
import {
  TelegramDispatchTaskStateSchema,
  TelegramIncidentJoinStateSchema,
  TelegramResourceReportStateSchema,
  TelegramSosStateSchema,
  TelegramWorkCenterReportStateSchema,
  TelegramFamilyReunificationStateSchema,
  handleTelegramFamilyReunificationFlow,
  handleTelegramDispatchTaskFlow,
  handleTelegramIncidentJoinFlow,
  handleTelegramResourceReportFlow,
  handleTelegramSosFlow,
  handleTelegramWorkCenterReportFlow,
  formatTelegramChannelLimitation,
  handleTelegramWebhookUpdate,
  isTerminalTelegramIncidentJoinState,
  isTerminalTelegramSosState,
  isTerminalTelegramWorkCenterReportState,
  parseTelegramIncidentJoinState,
  parseTelegramWorkCenterReportState,
  resolveTelegramCommand,
  safeParseTelegramDispatchTaskState,
  safeParseTelegramIncidentJoinState,
  safeParseTelegramResourceReportState,
  safeParseTelegramSosState,
  safeParseTelegramFamilyReunificationState,
  safeParseTelegramWorkCenterReportState,
  type TelegramDispatchTaskPorts,
  type TelegramDispatchTaskState,
  type TelegramFamilyReunificationPorts,
  type TelegramFamilyReunificationState,
  type TelegramFlowContext,
  type TelegramIncidentJoinPorts,
  type TelegramResourceNeedRecommendation,
  type TelegramResourceReportPorts,
  type TelegramResourceReportState,
  type TelegramIncidentJoinState,
  type TelegramSosPorts,
  type TelegramSosState,
  type TelegramWorkCenterReportPorts,
  type TelegramWorkCenterReportState,
} from './index';

const telegramUserUpdate = (text: string, languageCode = 'en') => ({
  message: {
    text,
    from: { id: 1001, first_name: 'Field', language_code: languageCode },
    chat: { id: 1001, type: 'private' },
  },
});

const telegramUserLocationUpdate = (latitude: number, longitude: number, languageCode = 'en') => ({
  message: {
    location: { latitude, longitude, horizontal_accuracy: 35 },
    from: { id: 1001, first_name: 'Field', language_code: languageCode },
    chat: { id: 1001, type: 'private' },
  },
});

function createPorts(overrides: Partial<TelegramIncidentJoinPorts> = {}): TelegramIncidentJoinPorts {
  return {
    listIncidents: vi.fn().mockResolvedValue(incidentListHappyFixture),
    getIncidentConfig: vi.fn().mockResolvedValue(incidentConfigHappyFixture),
    joinIncident: vi.fn().mockResolvedValue(telegramIncidentJoinResponseFixture),
    ...overrides,
  };
}

function createWorkCenterPorts(overrides: Partial<TelegramWorkCenterReportPorts> = {}): TelegramWorkCenterReportPorts {
  return {
    listIncidents: vi.fn().mockResolvedValue(incidentListHappyFixture),
    createWorkCenter: vi.fn().mockResolvedValue(workCenterCreateResponseHappyFixture),
    ...overrides,
  };
}



const freshSyncFreshnessFixture: SyncFreshness = {
  status: 'fresh',
  lastFreshAt: '2026-07-01T08:00:00.000Z',
  lastSyncedAt: '2026-07-01T08:00:00.000Z',
  cursorLag: 0,
  hasConflicts: false,
  channels: [
    {
      channel: 'mobile',
      status: 'fresh',
      lastFreshAt: '2026-07-01T08:00:00.000Z',
      lastSyncedAt: '2026-07-01T08:00:00.000Z',
      cursorLag: 0,
      hasConflicts: false,
    },
  ],
};

const resourceReportCreateResponseFixture: ResourceReportCreateResponse = {
  resourceReport: {
    resourceReportId: 'resource-report-water-needed',
    incidentId: 'incident-zc-demo',
    cellId: 'cell-zc-demo',
    workCenterId: 'center-north-triage',
    category: 'water',
    quantityApprox: '20 bottles',
    urgency: 'high',
    constraints: ['sealed bottles'],
    reportKind: 'needed',
    freshness: 'fresh',
    confidence: 'low',
    risk: 'medium',
    sourceChannel: 'telegram',
    createdAt: '2026-06-30T10:00:00.000Z',
    updatedAt: '2026-06-30T10:00:00.000Z',
  },
  audit: { auditEventId: 'audit_resource_report_created' },
  idempotent: false,
};

const resourceNeedRecommendationFixture: TelegramResourceNeedRecommendation = {
  incident: incidentListHappyFixture.incidents[0],
  workCenterId: 'center-pharmacy',
  workCenterName: 'Farmacia norte',
  category: 'medication',
  urgency: 'critical',
  score: 0.95,
  quantityApprox: '10 cajas',
  reasons: ['same_category', 'linked_work_center', 'urgency_high'],
};


const dispatchTaskFixture: DispatchTask = {
  dispatchTaskId: 'dispatch-task-water-1',
  incidentId: 'incident-zc-demo',
  cellId: 'cell-zc-demo',
  category: 'water',
  quantityApprox: '20 bottles',
  fromResourceReportId: 'resource-surplus-water',
  toResourceReportId: 'resource-report-water-needed',
  targetWorkCenterId: 'center-north-triage',
  status: 'pending',
  notes: 'Use sealed bottles',
  sourceChannel: 'web-ui',
  createdAt: '2026-06-30T10:00:00.000Z',
  updatedAt: '2026-06-30T10:00:00.000Z',
};

const dispatchTaskFoodFixture: DispatchTask = {
  ...dispatchTaskFixture,
  dispatchTaskId: 'dispatch-task-food-school',
  category: 'food',
  quantityApprox: '12 boxes',
  notes: 'Deliver to school shelter',
  targetWorkCenterId: 'center-school-shelter',
};

const dispatchTaskMedicineFixture: DispatchTask = {
  ...dispatchTaskFixture,
  dispatchTaskId: 'dispatch-task-medicine-pharmacy',
  category: 'medicine',
  quantityApprox: '4 kits',
  notes: 'Priority medicine for north pharmacy',
  targetWorkCenterId: 'center-north-pharmacy',
  status: 'accepted',
};

const dispatchTaskResponseFixture: DispatchTaskResponse = {
  dispatchTask: { ...dispatchTaskFixture, status: 'accepted', updatedAt: '2026-06-30T10:05:00.000Z' },
  audit: { auditEventId: 'audit_dispatch_task_updated' },
  idempotent: false,
};

function createResourcePorts(overrides: Partial<TelegramResourceReportPorts> = {}): TelegramResourceReportPorts {
  return {
    listIncidents: vi.fn().mockResolvedValue(incidentListHappyFixture),
    createResourceReport: vi.fn().mockResolvedValue(resourceReportCreateResponseFixture),
    ...overrides,
  };
}

function createDispatchPorts(overrides: Partial<TelegramDispatchTaskPorts> = {}): TelegramDispatchTaskPorts {
  return {
    listIncidents: vi.fn().mockResolvedValue(incidentListHappyFixture),
    listDispatchTasks: vi.fn().mockResolvedValue({ dispatchTasks: [dispatchTaskFixture] }),
    updateDispatchTask: vi.fn().mockResolvedValue(dispatchTaskResponseFixture),
    ...overrides,
  };
}

function createSosPorts(overrides: Partial<TelegramSosPorts> = {}): TelegramSosPorts {
  return {
    listIncidents: vi.fn().mockResolvedValue(incidentListHappyFixture),
    createSosAlert: vi.fn().mockResolvedValue(sosAlertCreateResponseHappyFixture),
    ...overrides,
  };
}

function createFamilyReunificationPorts(overrides: Partial<TelegramFamilyReunificationPorts> = {}): TelegramFamilyReunificationPorts {
  return {
    listIncidents: vi.fn().mockResolvedValue(incidentListHappyFixture),
    createPrivateLink: vi.fn().mockResolvedValue(privateFamilyReunificationIssueResponseFixture),
    formatPrivateLinkUrl: vi.fn((response) => `https://safe.example/family-reunification?token=${response.token}&correlationId=${response.correlationId}`),
    ...overrides,
  };
}

const validJoinStates = [
  { step: 'idle' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001', displayNameHint: 'Field Hint', desiredRole: 'medical' },
  { step: 'awaitingPseudonym', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayNameHint: 'Field Hint', desiredRole: 'medical' },
  { step: 'awaitingRole', config: incidentConfigHappyFixture, externalUserId: '1001', pseudonym: 'Field Telegram', desiredRole: 'medical' },
  { step: 'joined', response: telegramIncidentJoinResponseFixture },
  { step: 'cancelled' },
] satisfies TelegramIncidentJoinState[];


const validResourceStates = [
  { step: 'idle' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001', displayName: 'Field', preferredLocale: 'es' },
  { step: 'awaitingRecommendedNeedSelection', recommendations: [resourceNeedRecommendationFixture], externalUserId: '1001', displayName: 'Field', preferredLocale: 'es', category: 'medication' },
  { step: 'awaitingKind', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field', preferredLocale: 'es' },
  { step: 'awaitingCategory', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field', reportKind: 'needed' },
  { step: 'awaitingQuantity', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field', reportKind: 'needed', category: 'water' },
  { step: 'awaitingUrgency', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field', reportKind: 'needed', category: 'water', quantityApprox: '20 bottles' },
  { step: 'awaitingConstraints', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field', reportKind: 'needed', category: 'water', quantityApprox: '20 bottles', urgency: 'high' },
  { step: 'awaitingWorkCenter', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field', request: { channel: 'telegram', externalId: '1001', displayName: 'Field', payload: { category: 'water', quantityApprox: '20 bottles', urgency: 'high', constraints: ['sealed bottles'], reportKind: 'needed' } } },
  { step: 'awaitingConfirmation', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field', request: { channel: 'telegram', externalId: '1001', displayName: 'Field', payload: { category: 'water', quantityApprox: '20 bottles', urgency: 'high', constraints: ['sealed bottles'], reportKind: 'needed', workCenterId: 'center-north-triage' } } },
  { step: 'reported', response: resourceReportCreateResponseFixture },
  { step: 'cancelled' },
] satisfies TelegramResourceReportState[];

const validDispatchStates = [
  { step: 'idle' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001', prefill: { category: 'water', statusCandidate: 'accepted' } },
  { step: 'awaitingTask', incident: incidentListHappyFixture.incidents[0], tasks: [dispatchTaskFixture], externalUserId: '1001' },
  { step: 'awaitingTask', incident: incidentListHappyFixture.incidents[0], tasks: [dispatchTaskFixture], externalUserId: '1001', prefill: { taskHint: 'water', destinationHint: 'center-north-triage' } },
  { step: 'awaitingStatus', incident: incidentListHappyFixture.incidents[0], task: dispatchTaskFixture, externalUserId: '1001' },
  { step: 'awaitingConfirmation', incident: incidentListHappyFixture.incidents[0], task: dispatchTaskFixture, externalUserId: '1001', request: { channel: 'telegram', externalId: '1001', status: 'accepted' } },
  { step: 'updated', response: dispatchTaskResponseFixture },
  { step: 'cancelled' },
] satisfies TelegramDispatchTaskState[];

const validSosStates = [
  { step: 'idle' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001', displayName: 'Field' },
  {
    step: 'awaitingConfirmation',
    incident: incidentListHappyFixture.incidents[0],
    externalUserId: '1001',
    displayName: 'Field',
    request: { channel: 'telegram', externalId: '1001', displayName: 'Field', payload: { severity: 'critical' } },
  },
  { step: 'submitted', response: sosAlertCreateResponseHappyFixture },
  { step: 'cancelled' },
] satisfies TelegramSosState[];

const validFamilyReunificationStates = [
  { step: 'idle' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001', displayName: 'Field' },
  { step: 'linked', response: privateFamilyReunificationIssueResponseFixture },
  { step: 'cancelled' },
] satisfies TelegramFamilyReunificationState[];

const validWorkCenterStates = [
  { step: 'idle' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001', displayName: 'Field' },
  { step: 'awaitingName', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field' },
  {
    step: 'awaitingConfirmation',
    incident: incidentListHappyFixture.incidents[0],
    externalUserId: '1001',
    displayName: 'Field',
    request: telegramWorkCenterCreateRequestFixture,
  },
  { step: 'reported', response: workCenterCreateResponseHappyFixture },
  { step: 'cancelled' },
] satisfies TelegramWorkCenterReportState[];

async function advance(
  inputs: string[],
  ports = createPorts(),
  flowContext?: Extract<TelegramFlowContext, { sourceIntent: 'incident_join' }>,
): Promise<{ state: TelegramIncidentJoinState; responseText: string; ports: TelegramIncidentJoinPorts }> {
  let state: TelegramIncidentJoinState = { step: 'idle' };
  let responseText = '';

  for (const [index, input] of inputs.entries()) {
    const result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate(input), ports, index === 0 ? flowContext : undefined);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}


async function advanceResource(
  inputs: string[],
  ports = createResourcePorts(),
  languageCode = 'en',
): Promise<{ state: TelegramResourceReportState; responseText: string; ports: TelegramResourceReportPorts }> {
  let state: TelegramResourceReportState = { step: 'idle' };
  let responseText = '';

  for (const input of inputs) {
    const result = await handleTelegramResourceReportFlow(state, telegramUserUpdate(input, languageCode), ports);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}

async function advanceDispatch(
  inputs: string[],
  ports = createDispatchPorts(),
): Promise<{ state: TelegramDispatchTaskState; responseText: string; ports: TelegramDispatchTaskPorts }> {
  let state: TelegramDispatchTaskState = { step: 'idle' };
  let responseText = '';

  for (const input of inputs) {
    const result = await handleTelegramDispatchTaskFlow(state, telegramUserUpdate(input), ports);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}

async function advanceNaturalDispatch(
  inputs: string[],
  flowContext: Extract<TelegramFlowContext, { sourceIntent: 'dispatch' }>,
  ports = createDispatchPorts(),
): Promise<{ state: TelegramDispatchTaskState; responseText: string; ports: TelegramDispatchTaskPorts }> {
  let state: TelegramDispatchTaskState = { step: 'idle' };
  let responseText = '';

  for (const [index, input] of inputs.entries()) {
    const result = await handleTelegramDispatchTaskFlow(state, telegramUserUpdate(input, 'es'), ports, index === 0 ? flowContext : undefined);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}

async function advanceSos(
  inputs: string[],
  ports = createSosPorts(),
): Promise<{ state: TelegramSosState; responseText: string; ports: TelegramSosPorts }> {
  let state: TelegramSosState = { step: 'idle' };
  let responseText = '';

  for (const input of inputs) {
    const result = await handleTelegramSosFlow(state, telegramUserUpdate(input), ports);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}

async function advanceNaturalSos(
  inputs: string[],
  flowContext: Extract<TelegramFlowContext, { sourceIntent: 'sos' }>,
  ports = createSosPorts(),
): Promise<{ state: TelegramSosState; responseText: string; ports: TelegramSosPorts }> {
  let state: TelegramSosState = { step: 'idle' };
  let responseText = '';

  for (const [index, input] of inputs.entries()) {
    const result = await handleTelegramSosFlow(state, telegramUserUpdate(input, 'ca'), ports, index === 0 ? flowContext : undefined);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}

async function advanceFamilyReunification(
  inputs: string[],
  ports = createFamilyReunificationPorts(),
): Promise<{ state: TelegramFamilyReunificationState; responseText: string; ports: TelegramFamilyReunificationPorts }> {
  let state: TelegramFamilyReunificationState = { step: 'idle' };
  let responseText = '';

  for (const input of inputs) {
    const result = await handleTelegramFamilyReunificationFlow(state, telegramUserUpdate(input), ports);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}

async function advanceNaturalFamilyReunification(
  inputs: string[],
  flowContext: Extract<TelegramFlowContext, { sourceIntent: 'family_reunification' }>,
  ports = createFamilyReunificationPorts(),
): Promise<{ state: TelegramFamilyReunificationState; responseText: string; ports: TelegramFamilyReunificationPorts }> {
  let state: TelegramFamilyReunificationState = { step: 'idle' };
  let responseText = '';

  for (const [index, input] of inputs.entries()) {
    const result = await handleTelegramFamilyReunificationFlow(state, telegramUserUpdate(input, 'ca'), ports, index === 0 ? flowContext : undefined);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}

async function advanceWorkCenter(
  inputs: string[],
  ports = createWorkCenterPorts(),
): Promise<{ state: TelegramWorkCenterReportState; responseText: string; ports: TelegramWorkCenterReportPorts }> {
  let state: TelegramWorkCenterReportState = { step: 'idle' };
  let responseText = '';

  for (const input of inputs) {
    const result = await handleTelegramWorkCenterReportFlow(state, telegramUserUpdate(input), ports);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}

describe('telegram channel flows', () => {
  it('resolves slash commands without owning a runtime server', () => {
    expect(resolveTelegramCommand(telegramStartUpdateFixture)).toBe('/start');
  });

  it('returns a stable start flow response for API webhook integration', () => {
    expect(handleTelegramWebhookUpdate(telegramStartUpdateFixture)).toMatchObject({
      accepted: true,
      command: '/start',
      responseText: expect.stringContaining('Zona Cero'),
    });
  });

  it('handles Telegram language commands with canonical locale resolution', () => {
    expect(handleTelegramWebhookUpdate(telegramUserUpdate('/idioma es')).responseText).toContain('Idioma actualizado');
    expect(handleTelegramWebhookUpdate(telegramUserUpdate('/language en')).responseText).toContain('Language updated');
  });

  it('returns a stable SOS command response for API webhook integration', () => {
    expect(handleTelegramWebhookUpdate(telegramUserUpdate('/sos'))).toMatchObject({
      accepted: true,
      command: '/sos',
      responseText: expect.stringContaining('CONFIRM SOS'),
    });
  });

  it('returns a stable family reunification command response without requesting sensitive data', () => {
    const result = handleTelegramWebhookUpdate(telegramUserUpdate('/familia'));

    expect(result).toMatchObject({
      accepted: true,
      command: '/familia',
      responseText: expect.stringContaining('private web link'),
    });
    expect(result.responseText).toContain('Do not send names');
    expect(result.responseText).toContain('identifying traits');
    expect(result.responseText).toContain('phone numbers');
    expect(result.responseText).toContain('exact locations');
    expect(result.responseText).toContain('complete descriptions');
  });

  it('parses every valid incident join state variant and round-trips through JSON', () => {
    for (const state of validJoinStates) {
      const jsonState = JSON.parse(JSON.stringify(state));

      expect(TelegramIncidentJoinStateSchema.safeParse(jsonState).success).toBe(true);
      expect(safeParseTelegramIncidentJoinState(jsonState)).toEqual({ success: true, data: state });
      expect(parseTelegramIncidentJoinState(jsonState)).toEqual(state);
    }
  });

  it('rejects corrupt or unknown persisted incident join state', () => {
    const corruptStates = [
      null,
      { step: 'unknown' },
      { step: 'idle', unexpected: true },
      { step: 'awaitingIncident', incidents: [], externalUserId: '' },
      { step: 'awaitingPseudonym', incident: { incidentId: '' }, externalUserId: '1001' },
      { step: 'awaitingRole', config: incidentConfigHappyFixture, externalUserId: '1001' },
      { step: 'joined', response: { incident: incidentListHappyFixture.incidents[0] } },
    ];

    for (const state of corruptStates) {
      expect(safeParseTelegramIncidentJoinState(state).success).toBe(false);
      expect(TelegramIncidentJoinStateSchema.safeParse(state).success).toBe(false);
    }
  });

  it('parses every valid work center report state variant and round-trips through JSON', () => {
    for (const state of validWorkCenterStates) {
      const jsonState = JSON.parse(JSON.stringify(state));

      expect(TelegramWorkCenterReportStateSchema.safeParse(jsonState).success).toBe(true);
      expect(safeParseTelegramWorkCenterReportState(jsonState)).toEqual({ success: true, data: state });
      expect(parseTelegramWorkCenterReportState(jsonState)).toEqual(state);
    }
  });

  it('rejects corrupt or unknown persisted work center report state', () => {
    const corruptStates = [
      null,
      { step: 'unknown' },
      { step: 'idle', unexpected: true },
      { step: 'awaitingIncident', incidents: [], externalUserId: '' },
      { step: 'awaitingName', incident: { incidentId: '' }, externalUserId: '1001' },
      { step: 'awaitingConfirmation', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001' },
      { step: 'reported', response: { workCenter: workCenterCreateResponseHappyFixture.workCenter } },
    ];

    for (const state of corruptStates) {
      expect(safeParseTelegramWorkCenterReportState(state).success).toBe(false);
      expect(TelegramWorkCenterReportStateSchema.safeParse(state).success).toBe(false);
    }
  });

  it('identifies terminal incident join states', () => {
    expect(isTerminalTelegramIncidentJoinState({ step: 'joined', response: telegramIncidentJoinResponseFixture })).toBe(true);
    expect(isTerminalTelegramIncidentJoinState({ step: 'cancelled' })).toBe(true);
    expect(isTerminalTelegramIncidentJoinState({ step: 'idle' })).toBe(false);
    expect(
      isTerminalTelegramIncidentJoinState({
        step: 'awaitingIncident',
        incidents: incidentListHappyFixture.incidents,
        externalUserId: '1001',
      }),
    ).toBe(false);
  });

  it('identifies terminal work center report states', () => {
    expect(isTerminalTelegramWorkCenterReportState({ step: 'reported', response: workCenterCreateResponseHappyFixture })).toBe(true);
    expect(isTerminalTelegramWorkCenterReportState({ step: 'cancelled' })).toBe(true);
    expect(isTerminalTelegramWorkCenterReportState({ step: 'idle' })).toBe(false);
    expect(
      isTerminalTelegramWorkCenterReportState({
        step: 'awaitingIncident',
        incidents: incidentListHappyFixture.incidents,
        externalUserId: '1001',
      }),
    ).toBe(false);
  });

  it('runs the /start conversational join happy path with an injected port', async () => {
    const ports = createPorts();
    const { state, responseText } = await advance(['/start', '1', 'Field Telegram', '1'], ports);

    expect(state.step).toBe('joined');
    expect(responseText).toContain('Joined Zona Cero Demo Incident as volunteer');
    expect(responseText).toContain('Permissions: canReadIncident, canJoinIncident');
    expect(ports.joinIncident).toHaveBeenCalledWith('incident-zc-demo', {
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field Telegram',
      role: 'volunteer',
      preferredLocale: 'en',
    });
  });

  it('uses incident join flowContext as candidate-only onboarding hints', async () => {
    const ports = createPorts();
    const flowContext: Extract<TelegramFlowContext, { sourceIntent: 'incident_join' }> = {
      sourceIntent: 'incident_join',
      preferredLocale: 'es',
      facts: {
        signal: 'onboarding',
        incidentHint: 'Zona Cero Demo Incident',
        displayNameHint: 'Field Hint',
        desiredRole: 'medical',
        localeHint: 'en',
      },
      prefill: {},
      confidence: 0.91,
    };

    let result = await handleTelegramIncidentJoinFlow({ step: 'idle' }, telegramUserUpdate('I want to join as medical', 'ca'), ports, flowContext);
    expect(result.state).toMatchObject({
      step: 'awaitingPseudonym',
      displayNameHint: 'Field Hint',
      desiredRole: 'medical',
      preferredLocale: 'en',
    });
    expect(result.responseText).toContain('Detected pseudonym “Field Hint”');
    expect(ports.getIncidentConfig).not.toHaveBeenCalled();
    expect(ports.joinIncident).not.toHaveBeenCalled();

    result = await handleTelegramIncidentJoinFlow(result.state, telegramUserUpdate('yes', 'ca'), ports);
    expect(result.state).toMatchObject({ step: 'awaitingRole', pseudonym: 'Field Hint', desiredRole: 'medical' });
    expect(result.responseText).toContain('Suggested role: medical');
    expect(result.responseText).toContain('only a candidate');
    expect(result.responseText).toContain('backend will validate');
    expect(ports.joinIncident).not.toHaveBeenCalled();

    result = await handleTelegramIncidentJoinFlow(result.state, telegramUserUpdate('yes', 'ca'), ports);
    expect(result.state.step).toBe('joined');
    expect(ports.joinIncident).toHaveBeenCalledWith('incident-zc-demo', {
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field Hint',
      role: 'medical',
      preferredLocale: 'en',
    });
  });

  it('does not auto-select an ambiguous incident hint from flowContext', async () => {
    const duplicateIncident = {
      ...incidentListHappyFixture.incidents[0],
      incidentId: 'incident-zc-second',
      locationName: 'Second location',
    };
    const ports = createPorts({
      listIncidents: vi.fn().mockResolvedValue({ incidents: [incidentListHappyFixture.incidents[0], duplicateIncident] }),
    });
    const flowContext: Extract<TelegramFlowContext, { sourceIntent: 'incident_join' }> = {
      sourceIntent: 'incident_join',
      preferredLocale: 'en',
      facts: {
        signal: 'onboarding',
        incidentHint: 'zona cero demo incident',
        displayNameHint: 'Field Hint',
        desiredRole: 'coordinator',
      },
      prefill: {},
      confidence: 0.88,
    };

    const result = await handleTelegramIncidentJoinFlow({ step: 'idle' }, telegramUserUpdate('join the demo incident'), ports, flowContext);

    expect(result.state).toMatchObject({ step: 'awaitingIncident', displayNameHint: 'Field Hint', desiredRole: 'coordinator' });
    expect(result.responseText).toContain('more than one incident');
    expect(ports.getIncidentConfig).not.toHaveBeenCalled();
    expect(ports.joinIncident).not.toHaveBeenCalled();
  });



  it('localizes the incident join flow to Spanish for default Spanish users', async () => {
    const ports = createPorts();
    let state: TelegramIncidentJoinState = { step: 'idle' };

    let result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate('/start', 'es'), ports);
    expect(result.responseText).toContain('Elige un incidente');
    expect(result.responseText).not.toContain('Choose an incident');
    state = result.state;

    result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate('1', 'es'), ports);
    expect(result.responseText).toContain('Seleccionado:');
    expect(result.responseText).not.toContain('Selected:');
    state = result.state;

    result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate('Campo Telegram', 'es'), ports);
    expect(result.responseText).toContain('Elige tu rol');
    expect(result.responseText).not.toContain('Choose your role');
    state = result.state;

    result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate('1', 'es'), ports);
    expect(result.responseText).toContain('Te uniste a Zona Cero Demo Incident como volunteer');
    expect(result.responseText).not.toContain('Joined Zona Cero Demo Incident as volunteer');
    expect(ports.joinIncident).toHaveBeenCalledWith('incident-zc-demo', expect.objectContaining({ preferredLocale: 'es' }));
  });

  it('persists a changed locale during an active incident join flow for subsequent copy', async () => {
    const ports = createPorts();
    let state: TelegramIncidentJoinState = { step: 'idle' };

    let result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate('/start', 'es'), ports);
    state = result.state;

    result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate('/language en', 'es'), ports);
    expect(result.responseText).toContain('Language updated');
    expect(result.state).toMatchObject({ step: 'awaitingIncident', preferredLocale: 'en' });
    state = result.state;

    result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate('missing-incident', 'es'), ports);
    expect(result.responseText).toContain('Incident not found');
    expect(result.responseText).not.toContain('Incidente no encontrado');
  });

  it('localizes incident join incident-list empty and load-failure branches to Spanish', async () => {
    const emptyPorts = createPorts({ listIncidents: vi.fn().mockResolvedValue({ incidents: [] }) });
    const emptyResult = await handleTelegramIncidentJoinFlow({ step: 'idle' }, telegramUserUpdate('/start', 'es'), emptyPorts);

    expect(emptyResult.responseText).toBe('No hay incidentes activos ahora.');
    expect(emptyResult.state).toEqual({ step: 'idle', preferredLocale: 'es' });

    const failingPorts = createPorts({ listIncidents: vi.fn().mockRejectedValue(new Error('backend unavailable')) });
    const failingResult = await handleTelegramIncidentJoinFlow({ step: 'idle' }, telegramUserUpdate('/start', 'es'), failingPorts);

    expect(failingResult.responseText).toBe('No se pudieron cargar los incidentes desde el backend. Inténtalo de nuevo más tarde.');
    expect(failingResult.state).toEqual({ step: 'idle', preferredLocale: 'es' });
  });

  it('cancels an active join flow', async () => {
    const { state, responseText, ports } = await advance(['/start', '/cancel']);

    expect(state).toEqual({ step: 'cancelled' });
    expect(responseText).toContain('Join cancelled');
    expect(ports.joinIncident).not.toHaveBeenCalled();
  });

  it('keeps state and reports an invalid or missing incident selection', async () => {
    const ports = createPorts();
    const { state, responseText } = await advance(['/start', 'missing-incident'], ports);

    expect(state.step).toBe('awaitingIncident');
    expect(responseText).toContain('Incident not found');
    expect(ports.getIncidentConfig).not.toHaveBeenCalled();
    expect(ports.joinIncident).not.toHaveBeenCalled();
  });

  it('keeps state and reports an invalid role', async () => {
    const ports = createPorts();
    const { state, responseText } = await advance(['/start', 'incident-zc-demo', 'Field Telegram', 'admin'], ports);

    expect(state.step).toBe('awaitingRole');
    expect(responseText).toContain('Invalid role');
    expect(ports.joinIncident).not.toHaveBeenCalled();
  });

  it('shows a visible error when join fails', async () => {
    const ports = createPorts({
      joinIncident: vi.fn().mockRejectedValue(new Error('backend unavailable')),
    });
    const { state, responseText } = await advance(['/start', '1', 'Field Telegram', 'volunteer'], ports);

    expect(state.step).toBe('awaitingRole');
    expect(responseText).toContain('Could not join the incident');
  });


  it('formats Telegram channel limitations from backend freshness signals', () => {
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, status: 'stale' }, 'en')).toContain('backend freshness is stale');
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, status: 'expired' }, 'en')).toContain('backend freshness is expired');
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, status: 'missing', lastFreshAt: null, lastSyncedAt: null }, 'en')).toContain('backend freshness is missing');
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, cursorLag: 2 }, 'en')).toContain('2 backend updates may not be visible');
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, hasConflicts: true }, 'en')).toContain('sync conflicts need coordinator review');
  });

  it('does not add Telegram channel limitation noise for fresh backend freshness', () => {
    expect(formatTelegramChannelLimitation(freshSyncFreshnessFixture)).toBeNull();
  });

  it('shows Telegram channel limitation before collecting work center data when freshness is stale', async () => {
    const ports = createWorkCenterPorts({
      getChannelFreshness: vi.fn().mockResolvedValue({ ...freshSyncFreshnessFixture, status: 'stale', cursorLag: 3 }),
    });
    const { responseText } = await advanceWorkCenter(['/workcenter', '1'], ports);

    expect(responseText).toContain('Channel limitation');
    expect(responseText).toContain('backend freshness is stale');
    expect(responseText).toContain('3 backend updates may not be visible');
    expect(responseText).toContain('Send the work center name');
  });

  it('omits Telegram channel limitation before collecting work center data when freshness is fresh', async () => {
    const ports = createWorkCenterPorts({ getChannelFreshness: vi.fn().mockResolvedValue(freshSyncFreshnessFixture) });
    const { responseText } = await advanceWorkCenter(['/workcenter', '1'], ports);

    expect(responseText).not.toContain('Channel limitation');
    expect(responseText).toBe('Send the work center name. Use /cancel to stop.');
  });

  it('shows Telegram channel limitation before collecting work center data when freshness is expired', async () => {
    const ports = createWorkCenterPorts({
      getChannelFreshness: vi.fn().mockResolvedValue({ ...freshSyncFreshnessFixture, status: 'expired' }),
    });
    const { responseText } = await advanceWorkCenter(['/workcenter', '1'], ports);

    expect(responseText).toContain('Channel limitation');
    expect(responseText).toContain('backend freshness is expired');
    expect(responseText).toContain('Do not treat Telegram data as current');
    expect(responseText).toContain('Send the work center name');
  });

  it('shows Telegram channel limitation before collecting work center data when freshness is missing', async () => {
    const ports = createWorkCenterPorts({
      getChannelFreshness: vi.fn().mockResolvedValue({ ...freshSyncFreshnessFixture, status: 'missing', lastFreshAt: null, lastSyncedAt: null }),
    });
    const { responseText } = await advanceWorkCenter(['/workcenter', '1'], ports);

    expect(responseText).toContain('Channel limitation');
    expect(responseText).toContain('backend freshness is missing');
    expect(responseText).toContain('Telegram may be incomplete');
    expect(responseText).toContain('Send the work center name');
  });

  it('runs the /workcenter happy path and submits a schema-compatible minimal payload', async () => {
    const ports = createWorkCenterPorts();
    const { state, responseText } = await advanceWorkCenter(['/workcenter', '1', validWorkCenterCreatePayloadFixture.name, 'yes'], ports);

    expect(state.step).toBe('reported');
    expect(responseText).toContain('Work center reported: North triage point');
    expect(ports.createWorkCenter).toHaveBeenCalledWith('incident-zc-demo', {
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field',
      payload: {
        name: 'North triage point',
        priority: 'medium',
      },
    });
    expect(
      WorkCenterConnectedCreateRequestSchema.parse(vi.mocked(ports.createWorkCenter).mock.calls[0]?.[1]),
    ).toEqual({
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field',
      payload: {
        name: 'North triage point',
        priority: 'medium',
      },
    });
  });

  it('adds Telegram native location to the confirmed work center payload', async () => {
    const nativeLocation = { latitude: 41.3851, longitude: 2.1734 };
    const createWorkCenter = vi.fn().mockImplementation(async (_incidentId: string, request: WorkCenterConnectedCreateRequest): Promise<WorkCenterCreateResponse> => ({
      ...workCenterCreateResponseHappyFixture,
      workCenter: {
        ...workCenterCreateResponseHappyFixture.workCenter,
        location: request.payload.location,
      },
    }));
    const ports = createWorkCenterPorts({ createWorkCenter });

    let state: TelegramWorkCenterReportState = { step: 'idle' };
    let result = await handleTelegramWorkCenterReportFlow(state, telegramUserUpdate('/workcenter'), ports);
    state = result.state;
    result = await handleTelegramWorkCenterReportFlow(state, telegramUserUpdate('1'), ports);
    state = result.state;
    result = await handleTelegramWorkCenterReportFlow(state, telegramUserUpdate(validWorkCenterCreatePayloadFixture.name), ports);
    state = result.state;

    result = await handleTelegramWorkCenterReportFlow(state, telegramUserLocationUpdate(nativeLocation.latitude, nativeLocation.longitude), ports);

    expect(result.state).toMatchObject({
      step: 'awaitingConfirmation',
      request: { payload: expect.objectContaining({ location: nativeLocation }) },
    });
    expect(result.responseText).toContain('Approximate coordinates: 41.38510, 2.17340');
    state = result.state;

    result = await handleTelegramWorkCenterReportFlow(state, telegramUserUpdate('yes'), ports);

    expect(result.state).toMatchObject({
      step: 'reported',
      response: { workCenter: expect.objectContaining({ location: nativeLocation }) },
    });
    expect(createWorkCenter).toHaveBeenCalledWith('incident-zc-demo', {
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field',
      payload: {
        name: 'North triage point',
        priority: 'medium',
        location: nativeLocation,
      },
    });
    expect(WorkCenterConnectedCreateRequestSchema.parse(createWorkCenter.mock.calls[0]?.[1]).payload.location).toEqual(nativeLocation);
  });

  it('prefills a natural-language work center report and requires explicit confirmation before creation', async () => {
    const ports = createWorkCenterPorts();
    const flowContext = {
      preferredLocale: 'es' as const,
      sourceIntent: 'workcenter' as const,
      confidence: 0.94,
      facts: { signal: 'availability' as const, name: 'puesto médico', locationHint: 'escuela', priority: 'high' as const, initialNeed: 'medicamentos', surplus: 'camillas', implicitQuestion: 'none' as const },
      prefill: { name: 'puesto médico', locationHint: 'escuela', priority: 'high' as const, initialNeed: 'medicamentos', surplus: 'camillas' },
    };

    let state: TelegramWorkCenterReportState = { step: 'idle' };
    let result = await handleTelegramWorkCenterReportFlow(state, telegramUserUpdate('Hay un puesto médico en la escuela con prioridad alta y necesitan medicamentos.', 'es'), ports, flowContext);
    state = result.state;

    expect(state).toMatchObject({ step: 'awaitingIncident', prefill: expect.objectContaining({ name: 'puesto médico', priority: 'high', initialNeed: 'medicamentos' }) });
    expect(ports.createWorkCenter).not.toHaveBeenCalled();

    result = await handleTelegramWorkCenterReportFlow(state, telegramUserUpdate('1', 'es'), ports);

    expect(result.state.step).toBe('awaitingConfirmation');
    expect(result.responseText).toContain('Confirma el reporte de puesto de trabajo');
    expect(result.responseText).toContain('Nombre: puesto médico');
    expect(result.responseText).toContain('Ubicación aproximada: escuela');
    expect(result.responseText).toContain('Prioridad: high');
    expect(ports.createWorkCenter).not.toHaveBeenCalled();

    result = await handleTelegramWorkCenterReportFlow(result.state, telegramUserUpdate('sí', 'es'), ports);

    expect(result.state.step).toBe('reported');
    expect(ports.createWorkCenter).toHaveBeenCalledWith('incident-zc-demo', {
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field',
      payload: {
        name: 'puesto médico',
        description: 'Location hint: escuela',
        priority: 'high',
        initialNeed: 'medicamentos',
        surplus: 'camillas',
      },
    });
    expect(vi.mocked(ports.createWorkCenter).mock.calls[0]?.[1].payload).not.toHaveProperty('location');
  });

  it('asks only for a missing natural-language work center name and preserves safe prefill', async () => {
    const ports = createWorkCenterPorts();
    const flowContext = {
      preferredLocale: 'en' as const,
      sourceIntent: 'workcenter' as const,
      confidence: 0.91,
      facts: { signal: 'availability' as const, locationHint: 'school', priority: 'high' as const, initialNeed: 'medicine', implicitQuestion: 'none' as const },
      prefill: { locationHint: 'school', priority: 'high' as const, initialNeed: 'medicine' },
    };

    let result = await handleTelegramWorkCenterReportFlow({ step: 'idle' }, telegramUserUpdate('There is a medical post at the school with high priority and they need medicine.'), ports, flowContext);
    result = await handleTelegramWorkCenterReportFlow(result.state, telegramUserUpdate('1'), ports);

    expect(result.state).toMatchObject({ step: 'awaitingName', prefill: expect.objectContaining({ description: 'Location hint: school', priority: 'high', initialNeed: 'medicine' }) });
    expect(result.responseText).toContain('Send only the work center name');
    expect(ports.createWorkCenter).not.toHaveBeenCalled();

    result = await handleTelegramWorkCenterReportFlow(result.state, telegramUserUpdate('School medical post'), ports);

    expect(result.state.step).toBe('awaitingConfirmation');
    expect(result.responseText).toContain('Name: School medical post');
    expect(result.responseText).toContain('Location hint: school');
    expect(ports.createWorkCenter).not.toHaveBeenCalled();
  });

  it('allows safe work center name correction before explicit confirmation', async () => {
    const ports = createWorkCenterPorts();
    const { state } = await advanceWorkCenter(['/workcenter', '1', 'Wrong name'], ports);

    const corrected = await handleTelegramWorkCenterReportFlow(state, telegramUserUpdate('name: Corrected triage point'), ports);

    expect(corrected.state).toMatchObject({ step: 'awaitingConfirmation', request: expect.objectContaining({ payload: expect.objectContaining({ name: 'Corrected triage point' }) }) });
    expect(corrected.responseText).toContain('Name: Corrected triage point');
    expect(ports.createWorkCenter).not.toHaveBeenCalled();
  });

  it('cancels an active work center report flow before submitting', async () => {
    const { state, responseText, ports } = await advanceWorkCenter(['/workcenter', '1', 'North triage point', 'no']);

    expect(state).toEqual({ step: 'cancelled' });
    expect(responseText).toContain('Work center report cancelled');
    expect(ports.createWorkCenter).not.toHaveBeenCalled();
  });

  it('keeps work center state and reports invalid minimal payload handling', async () => {
    const ports = createWorkCenterPorts();
    const { state, responseText } = await advanceWorkCenter(['/workcenter', '1', '   '], ports);

    expect(state.step).toBe('awaitingName');
    expect(responseText).toContain('Work center name is required');
    expect(ports.createWorkCenter).not.toHaveBeenCalled();
  });

  it('shows stable permission errors when the API requires incident join first', async () => {
    const ports = createWorkCenterPorts({
      createWorkCenter: vi.fn().mockRejectedValue({ error: 'permission_denied' }),
    });
    const { state, responseText } = await advanceWorkCenter(['/workcenter', 'incident-zc-demo', 'North triage point', 'yes'], ports);

    expect(state.step).toBe('awaitingConfirmation');
    expect(responseText).toContain('Permission denied');
    expect(responseText).toContain('Join this incident first with /start');
  });

  it('uses shared work center fixtures as a consumer contract against the schema', () => {
    expect(WorkCenterConnectedCreateRequestSchema.parse(telegramWorkCenterCreateRequestFixture)).toEqual(
      telegramWorkCenterCreateRequestFixture,
    );
    expect(WorkCenterConnectedCreateRequestSchema.safeParse({ ...telegramWorkCenterCreateRequestFixture, payload: { name: '' } }).success).toBe(
      false,
    );
  });



  it('parses resource report and dispatch task flow states for API persistence', () => {
    for (const state of validResourceStates) {
      const jsonState = JSON.parse(JSON.stringify(state));
      expect(TelegramResourceReportStateSchema.safeParse(jsonState).success).toBe(true);
      expect(safeParseTelegramResourceReportState(jsonState)).toEqual({ success: true, data: state });
    }

    for (const state of validDispatchStates) {
      const jsonState = JSON.parse(JSON.stringify(state));
      expect(TelegramDispatchTaskStateSchema.safeParse(jsonState).success).toBe(true);
      expect(safeParseTelegramDispatchTaskState(jsonState)).toEqual({ success: true, data: state });
    }

    for (const state of validSosStates) {
      const jsonState = JSON.parse(JSON.stringify(state));
      expect(TelegramSosStateSchema.safeParse(jsonState).success).toBe(true);
      expect(safeParseTelegramSosState(jsonState)).toEqual({ success: true, data: state });
    }

    for (const state of validFamilyReunificationStates) {
      const jsonState = JSON.parse(JSON.stringify(state));
      expect(TelegramFamilyReunificationStateSchema.safeParse(jsonState).success).toBe(true);
      expect(safeParseTelegramFamilyReunificationState(jsonState)).toEqual({ success: true, data: state });
    }
  });

  it('runs the /resource happy path with canonical report kind, urgency and optional work center id', async () => {
    const ports = createResourcePorts();
    const { state, responseText } = await advanceResource(['/resource', '1', 'needed', 'water', '20 bottles', 'high', 'sealed bottles', 'center-north-triage', 'yes'], ports);

    expect(state.step).toBe('reported');
    expect(responseText).toContain('Resource needed reported: water');
    expect(ports.createResourceReport).toHaveBeenCalledWith('incident-zc-demo', {
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field',
      payload: {
        category: 'water',
        quantityApprox: '20 bottles',
        urgency: 'high',
        constraints: ['sealed bottles'],
        reportKind: 'needed',
        workCenterId: 'center-north-triage',
      },
    });
    expect(ResourceReportConnectedCreateRequestSchema.parse(vi.mocked(ports.createResourceReport).mock.calls[0]?.[1]).payload.reportKind).toBe('needed');
  });

  it('starts the resource flow in Spanish for clear Spanish resource text', async () => {
    const result = await handleTelegramResourceReportFlow({ step: 'idle' }, telegramUserUpdate('tengo medicamentos, dónde la necesitan?', 'ca'), createResourcePorts());

    expect(result.state).toMatchObject({ step: 'awaitingIncident', preferredLocale: 'es' });
    expect(result.responseText).toContain('Elige un incidente antes de reportar recursos');
    expect(result.responseText).not.toContain('Choose an incident before reporting resources');
  });

  it('shows Spanish need recommendations for an implicit where-needed offer before generic incidents', async () => {
    const ports = createResourcePorts({
      listResourceNeedRecommendations: vi.fn().mockResolvedValue({ recommendations: [resourceNeedRecommendationFixture] }),
    });

    const result = await handleTelegramResourceReportFlow({ step: 'idle' }, telegramUserUpdate('tengo medicamentos, dónde la necesitan?', 'ca'), ports);

    expect(result.state).toMatchObject({ step: 'awaitingRecommendedNeedSelection', preferredLocale: 'es', category: 'medication' });
    expect(result.responseText).toContain('Encontré necesidades compatibles');
    expect(result.responseText).toContain('1.');
    expect(result.responseText).toContain('Farmacia norte');
    expect(result.responseText).toContain('Elige destino respondiendo con un número');
    expect(result.responseText).not.toContain('Elige un incidente antes de reportar recursos');
    expect(ports.listIncidents).not.toHaveBeenCalled();
  });

  it('selects a recommended need and continues the surplus offer flow with incident and work center preselected', async () => {
    const ports = createResourcePorts({
      listResourceNeedRecommendations: vi.fn().mockResolvedValue({ recommendations: [resourceNeedRecommendationFixture] }),
    });

    let result = await handleTelegramResourceReportFlow({ step: 'idle' }, telegramUserUpdate('tengo medicamentos, dónde la necesitan?', 'ca'), ports);
    result = await handleTelegramResourceReportFlow(result.state, telegramUserUpdate('1', 'ca'), ports);

    expect(result.state).toMatchObject({
      step: 'awaitingQuantity',
      incident: resourceNeedRecommendationFixture.incident,
      reportKind: 'surplus',
      category: 'medication',
      recommendedWorkCenterId: 'center-pharmacy',
      preferredLocale: 'es',
    });
    expect(result.responseText).toContain('Envía la cantidad aproximada');
  });

  it('starts the resource flow in English for clear English resource text', async () => {
    const result = await handleTelegramResourceReportFlow({ step: 'idle' }, telegramUserUpdate('I have medicine, where is it needed?', 'ca'), createResourcePorts());

    expect(result.state).toMatchObject({ step: 'awaitingIncident', preferredLocale: 'en' });
    expect(result.responseText).toContain('Choose an incident before reporting resources');
    expect(result.responseText).not.toContain('Elige un incidente antes de reportar recursos');
  });

  it('cancels the resource flow on permission denied so API persistence clears it', async () => {
    const ports = createResourcePorts({ createResourceReport: vi.fn().mockRejectedValue({ error: 'permission_denied' }) });
    const { state, responseText } = await advanceResource(['/resource', '1', 'sobrante', 'mantas', '10 cajas', 'media', 'omitir', 'omitir', 'sí'], ports, 'es');

    expect(state.step).toBe('cancelled');
    expect(responseText).toContain('Permiso denegado');
  });

  it('runs the /dispatch happy path using canonical dispatch statuses', async () => {
    const ports = createDispatchPorts();
    const { state, responseText } = await advanceDispatch(['/dispatch', '1', '1', 'en camino', 'yes'], ports);

    expect(state.step).toBe('updated');
    expect(responseText).toContain('Dispatch task updated');
    expect(ports.updateDispatchTask).toHaveBeenCalledWith('incident-zc-demo', 'dispatch-task-water-1', {
      channel: 'telegram',
      externalId: '1001',
      status: 'en_route',
    });
    expect(DispatchTaskConnectedUpdateRequestSchema.parse(vi.mocked(ports.updateDispatchTask).mock.calls[0]?.[2]).status).toBe('en_route');
  });

  it('prefills natural-language dispatch status candidates but waits for task selection and explicit confirmation', async () => {
    const ports = createDispatchPorts();
    const flowContext = {
      preferredLocale: 'es' as const,
      sourceIntent: 'dispatch' as const,
      confidence: 0.93,
      facts: { signal: 'status_update' as const, action: 'update' as const, taskHint: 'water', category: 'water', statusCandidate: 'accepted' as const },
      prefill: { taskHint: 'water', category: 'water', statusCandidate: 'accepted' as const },
    };

    let result = await handleTelegramDispatchTaskFlow({ step: 'idle' }, telegramUserUpdate('Acepta la tarea de agua', 'es'), ports, flowContext);

    expect(result.state).toMatchObject({ step: 'awaitingIncident', prefill: expect.objectContaining({ taskHint: 'water', statusCandidate: 'accepted' }) });
    expect(ports.updateDispatchTask).not.toHaveBeenCalled();

    result = await handleTelegramDispatchTaskFlow(result.state, telegramUserUpdate('1', 'es'), ports);

    expect(result.state).toMatchObject({ step: 'awaitingTask', prefill: expect.objectContaining({ statusCandidate: 'accepted' }) });
    expect(result.responseText).toContain('Choose a dispatch task');
    expect(ports.updateDispatchTask).not.toHaveBeenCalled();

    result = await handleTelegramDispatchTaskFlow(result.state, telegramUserUpdate('1', 'es'), ports);

    expect(result.state).toMatchObject({ step: 'awaitingConfirmation', request: { status: 'accepted' } });
    expect(result.responseText).toContain('Confirm dispatch task update');
    expect(result.responseText).toContain('Status: accepted');
    expect(ports.updateDispatchTask).not.toHaveBeenCalled();

    result = await handleTelegramDispatchTaskFlow(result.state, telegramUserUpdate('sí', 'es'), ports);

    expect(result.state.step).toBe('updated');
    expect(ports.updateDispatchTask).toHaveBeenCalledWith('incident-zc-demo', 'dispatch-task-water-1', {
      channel: 'telegram',
      externalId: '1001',
      status: 'accepted',
    });
  });

  it('orders dispatch candidates by task hint, category, quantity and destination with stable tie handling', async () => {
    const ports = createDispatchPorts({
      listDispatchTasks: vi.fn().mockResolvedValue({
        dispatchTasks: [dispatchTaskFoodFixture, dispatchTaskFixture, dispatchTaskMedicineFixture],
      }),
    });
    const flowContext = {
      preferredLocale: 'es' as const,
      sourceIntent: 'dispatch' as const,
      confidence: 0.91,
      facts: { signal: 'status_update' as const, action: 'update' as const, category: 'medicine', quantityApprox: '4 kits', destinationHint: 'pharmacy' },
      prefill: { category: 'medicine', quantityApprox: '4 kits', destinationHint: 'pharmacy' },
    };

    const { state, responseText } = await advanceNaturalDispatch(['Marca medicina para farmacia como entregada', '1'], flowContext, ports);

    expect(state).toMatchObject({
      step: 'awaitingTask',
      tasks: [
        expect.objectContaining({ dispatchTaskId: 'dispatch-task-medicine-pharmacy' }),
        expect.objectContaining({ dispatchTaskId: 'dispatch-task-food-school' }),
        expect.objectContaining({ dispatchTaskId: 'dispatch-task-water-1' }),
      ],
    });
    expect(responseText.indexOf('dispatch-task-medicine-pharmacy')).toBeLessThan(responseText.indexOf('dispatch-task-food-school'));
    expect(responseText.indexOf('dispatch-task-food-school')).toBeLessThan(responseText.indexOf('dispatch-task-water-1'));
    expect(ports.updateDispatchTask).not.toHaveBeenCalled();
  });

  it('keeps dispatch candidate order stable when hints do not match any task', async () => {
    const ports = createDispatchPorts({
      listDispatchTasks: vi.fn().mockResolvedValue({
        dispatchTasks: [dispatchTaskFoodFixture, dispatchTaskFixture],
      }),
    });
    const flowContext = {
      preferredLocale: 'en' as const,
      sourceIntent: 'dispatch' as const,
      confidence: 0.83,
      facts: { signal: 'status_update' as const, action: 'update' as const, taskHint: 'unmatched crane' },
      prefill: { taskHint: 'unmatched crane' },
    };

    const { state, responseText } = await advanceNaturalDispatch(['Update the unmatched crane task', '1'], flowContext, ports);

    expect(state).toMatchObject({
      step: 'awaitingTask',
      tasks: [
        expect.objectContaining({ dispatchTaskId: 'dispatch-task-food-school' }),
        expect.objectContaining({ dispatchTaskId: 'dispatch-task-water-1' }),
      ],
    });
    expect(responseText.indexOf('dispatch-task-food-school')).toBeLessThan(responseText.indexOf('dispatch-task-water-1'));
  });

  it('cancels a natural-language dispatch confirmation before submitting', async () => {
    const ports = createDispatchPorts();
    const flowContext = {
      preferredLocale: 'es' as const,
      sourceIntent: 'dispatch' as const,
      confidence: 0.9,
      facts: { signal: 'status_update' as const, action: 'update' as const, status: 'delivered' as const },
      prefill: { status: 'delivered' as const },
    };
    const { state, responseText } = await advanceNaturalDispatch(['Marca la tarea como entregada', '1', '1', 'no'], flowContext, ports);

    expect(state).toEqual({ step: 'cancelled' });
    expect(responseText).toContain('Dispatch task update cancelled');
    expect(ports.updateDispatchTask).not.toHaveBeenCalled();
  });

  it('rejects non-canonical dispatch statuses before calling the backend', async () => {
    const ports = createDispatchPorts();
    const { state, responseText } = await advanceDispatch(['/dispatch', '1', '1', 'done'], ports);

    expect(state.step).toBe('awaitingStatus');
    expect(responseText).toContain('Invalid status');
    expect(ports.updateDispatchTask).not.toHaveBeenCalled();
  });

  it('runs the /sos happy path with exact strong confirmation and honest acknowledgement', async () => {
    const ports = createSosPorts();
    const { state, responseText } = await advanceSos(['/sos', '1', 'CONFIRM SOS'], ports);

    expect(state.step).toBe('submitted');
    expect(responseText).toContain('SOS ID: sos-mobile-critical-1');
    expect(responseText).toContain('Status: open');
    expect(responseText).toContain('Fan-out: total 3, queued 3, pending 0, failed 0, cancelled 0');
    expect(responseText).toContain('does not confirm delivery, rescue, or exact location');
    expect(ports.createSosAlert).toHaveBeenCalledWith('incident-zc-demo', {
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field',
      payload: { severity: 'critical', reportedAt: expect.any(String) },
    });
    const sosRequest = SosConnectedCreateRequestSchema.parse(vi.mocked(ports.createSosAlert).mock.calls[0]?.[1]);
    expect(sosRequest.payload.severity).toBe('critical');
    expect(sosRequest.payload.reportedAt).toEqual(expect.any(String));
    expect(isTerminalTelegramSosState(state)).toBe(true);
  });

  it('shows natural-language SOS facts only in the initial response and keeps persisted state sanitized', async () => {
    const ports = createSosPorts();
    const flowContext = {
      sourceIntent: 'sos',
      preferredLocale: 'es',
      confidence: 0.94,
      facts: {
        severity: 'medical',
        locationHint: 'refugio norte',
        medicalNeed: 'ayuda médica urgente',
        peopleCount: 3,
        hazardHint: 'humo',
      },
      prefill: {
        severity: 'medical',
        locationHint: 'refugio norte',
        medicalNeed: 'ayuda médica urgente',
        peopleCount: 3,
        hazardHint: 'humo',
      },
    } satisfies Extract<TelegramFlowContext, { sourceIntent: 'sos' }>;

    const initial = await handleTelegramSosFlow({ step: 'idle' }, telegramUserUpdate('necesito ayuda médica urgente en el refugio norte', 'ca'), ports, flowContext);

    expect(initial.state.step).toBe('awaitingIncident');
    expect(initial.responseText).toContain('Resumen seguro detectado');
    expect(initial.responseText).toContain('Gravedad: medical');
    expect(initial.responseText).toContain('Ubicación aproximada: refugio norte');
    expect(initial.responseText).toContain('Necesidad médica: ayuda médica urgente');
    expect(initial.responseText).toContain('Personas afectadas: 3');
    expect(initial.responseText).toContain('Riesgo: humo');
    expect(initial.responseText).toContain('Elige un incidente antes de iniciar SOS');
    expect(ports.createSosAlert).not.toHaveBeenCalled();

    const initialStateJson = JSON.stringify(TelegramSosStateSchema.parse(JSON.parse(JSON.stringify(initial.state))));
    expect(initialStateJson).not.toMatch(/refugio norte|ayuda médica urgente|humo|locationHint|medicalNeed|peopleCount|hazardHint|prefill/i);

    const selected = await handleTelegramSosFlow(initial.state, telegramUserUpdate('1', 'es'), ports);
    expect(selected.state.step).toBe('awaitingConfirmation');
    expect(selected.responseText).toContain('CONFIRM SOS');
    expect(selected.responseText).not.toContain('Resumen seguro detectado');
    expect(selected.responseText).not.toMatch(/refugio norte|ayuda médica urgente|humo|Personas afectadas/i);

    const selectedState = TelegramSosStateSchema.parse(JSON.parse(JSON.stringify(selected.state)));
    const selectedStateJson = JSON.stringify(selectedState);
    expect(selectedStateJson).not.toMatch(/refugio norte|ayuda médica urgente|humo|locationHint|medicalNeed|peopleCount|hazardHint|prefill/i);
    expect(selectedState.step === 'awaitingConfirmation' ? selectedState.request.payload : {}).toMatchObject({ severity: 'critical' });
    expect(selectedState.step === 'awaitingConfirmation' ? selectedState.request.payload : {}).not.toHaveProperty('location');
    expect(selectedState.step === 'awaitingConfirmation' ? selectedState.request.payload : {}).not.toHaveProperty('message');
  });

  it('requires strong confirmation after natural-language SOS context before creating the alert', async () => {
    const ports = createSosPorts();
    const flowContext = {
      sourceIntent: 'sos',
      preferredLocale: 'en',
      confidence: 0.91,
      facts: { severity: 'medical', locationHint: 'north shelter', medicalNeed: 'urgent medical help' },
      prefill: { severity: 'medical', locationHint: 'north shelter', medicalNeed: 'urgent medical help' },
    } satisfies Extract<TelegramFlowContext, { sourceIntent: 'sos' }>;

    const weak = await advanceNaturalSos(['I need urgent medical help at the north shelter', '1', 'confirm'], flowContext, ports);
    expect(weak.state.step).toBe('awaitingConfirmation');
    expect(weak.responseText).toContain('reply exactly CONFIRM SOS');
    expect(JSON.stringify(weak.state)).not.toMatch(/north shelter|urgent medical help|locationHint|medicalNeed|prefill/i);
    expect(ports.createSosAlert).not.toHaveBeenCalled();

    const confirmed = await handleTelegramSosFlow(weak.state, telegramUserUpdate('CONFIRM SOS'), ports);
    expect(confirmed.state.step).toBe('submitted');
    expect(ports.createSosAlert).toHaveBeenCalledWith('incident-zc-demo', {
      channel: 'telegram',
      externalId: '1001',
      displayName: 'Field',
      payload: { severity: 'critical', reportedAt: expect.any(String) },
    });
  });

  it('cancels natural-language SOS before confirmation without creating an alert', async () => {
    const ports = createSosPorts();
    const flowContext = {
      sourceIntent: 'sos',
      preferredLocale: 'en',
      confidence: 0.9,
      facts: { severity: 'security', locationHint: 'north gate', hazardHint: 'smoke' },
      prefill: { severity: 'security', locationHint: 'north gate', hazardHint: 'smoke' },
    } satisfies Extract<TelegramFlowContext, { sourceIntent: 'sos' }>;

    const { state, responseText } = await advanceNaturalSos(['there is smoke at the north gate and I need help', '1', '/cancel'], flowContext, ports);

    expect(state).toEqual({ step: 'cancelled' });
    expect(responseText).toContain('SOS cancelled before backend submission');
    expect(ports.createSosAlert).not.toHaveBeenCalled();
  });

  it('falls back to the current safe SOS flow when natural-language facts are absent', async () => {
    const flowContext = {
      sourceIntent: 'sos',
      preferredLocale: 'en',
      confidence: 0.86,
      facts: null,
      prefill: {},
    } satisfies Extract<TelegramFlowContext, { sourceIntent: 'sos' }>;

    const { state, responseText } = await advanceNaturalSos(['help', '1'], flowContext);

    expect(state.step).toBe('awaitingConfirmation');
    expect(responseText).toContain('Reply exactly CONFIRM SOS');
    expect(responseText).not.toContain('Safe detected summary');
    expect(state.step === 'awaitingConfirmation' ? state.request.payload : {}).toMatchObject({ severity: 'critical' });
  });

  it('localizes /sos empty incident selection in Spanish/default locale', async () => {
    const ports = createSosPorts({ listIncidents: vi.fn().mockResolvedValue({ incidents: [] }) });
    const result = await handleTelegramSosFlow({ step: 'idle' }, telegramUserUpdate('/sos', 'es'), ports);

    expect(result.state).toEqual({ step: 'idle', preferredLocale: 'es' });
    expect(result.responseText).toContain('No hay incidentes activos ahora para iniciar SOS.');
    expect(result.responseText).not.toContain('No active incidents are available right now.');
  });

  it('localizes /sos incident load failures in Spanish/default locale', async () => {
    const ports = createSosPorts({ listIncidents: vi.fn().mockRejectedValue(new Error('backend down')) });
    const result = await handleTelegramSosFlow({ step: 'idle' }, telegramUserUpdate('/sos', 'es'), ports);

    expect(result.state).toEqual({ step: 'idle', preferredLocale: 'es' });
    expect(result.responseText).toContain('No se pudieron cargar los incidentes para SOS desde el backend.');
    expect(result.responseText).not.toContain('Could not load incidents from the backend. Please try again later.');
  });

  it('keeps SOS state and does not call the backend when confirmation is not exact', async () => {
    const ports = createSosPorts();
    const { state, responseText } = await advanceSos(['/sos', '1', 'confirm'], ports);

    expect(state.step).toBe('awaitingConfirmation');
    expect(responseText).toContain('reply exactly CONFIRM SOS');
    expect(ports.createSosAlert).not.toHaveBeenCalled();
  });

  it('cancels SOS safely before backend submission', async () => {
    const ports = createSosPorts();
    const { state, responseText } = await advanceSos(['/sos', '1', 'no'], ports);

    expect(state).toEqual({ step: 'cancelled' });
    expect(responseText).toContain('SOS cancelled before backend submission');
    expect(ports.createSosAlert).not.toHaveBeenCalled();
  });

  it('keeps SOS confirmation state and reports backend errors visibly', async () => {
    const ports = createSosPorts({ createSosAlert: vi.fn().mockRejectedValue({ error: 'permission_denied' }) });
    const { state, responseText } = await advanceSos(['/sos', 'incident-zc-demo', 'CONFIRM SOS'], ports);

    expect(state.step).toBe('awaitingConfirmation');
    expect(responseText).toContain('Permission denied');
    expect(responseText).toContain('Join this incident first with /start');
  });

  it('runs the /familia flow by requesting a scoped private web link from the backend', async () => {
    const ports = createFamilyReunificationPorts();
    const { state, responseText } = await advanceFamilyReunification(['/familia', '1'], ports);

    expect(state.step).toBe('linked');
    expect(responseText).toContain('https://safe.example/family-reunification');
    expect(responseText).toContain('Do not send names');
    expect(responseText).toContain('identifying traits');
    expect(responseText).toContain('phone numbers');
    expect(responseText).toContain('exact locations');
    expect(responseText).toContain('complete descriptions');
    expect(responseText).toContain('in-person verification');
    expect(ports.createPrivateLink).toHaveBeenCalledWith('incident-zc-demo', {
      scope: 'family_reunification.search',
      channel: 'web-ui',
      externalId: 'web-user-1001',
      displayName: 'Field Web',
      correlationId: 'corr-family-reunification-search-1',
      returnState: 'web:family-reunification:search',
      ttlSeconds: 600,
      maxUses: 1,
      metadata: {},
    });

    const request = PrivateWebLinkIssueRequestSchema.parse(vi.mocked(ports.createPrivateLink).mock.calls[0]?.[1]);
    expect(request.scope).toBe('family_reunification.search');
    expect(request.ttlSeconds).toBe(600);
    expect(request.maxUses).toBe(1);
  });

  it('keeps the /reunificacion command flow working through private link issuance', async () => {
    const ports = createFamilyReunificationPorts();
    const { state, responseText } = await advanceFamilyReunification(['/reunificacion', 'incident-zc-demo'], ports);

    expect(state.step).toBe('linked');
    expect(responseText).toContain('https://safe.example/family-reunification');
    expect(ports.createPrivateLink).toHaveBeenCalledWith('incident-zc-demo', expect.objectContaining({
      scope: 'family_reunification.search',
      channel: 'web-ui',
      maxUses: 1,
    }));
  });

  it('uses natural family reunification flow context without echoing sensitive details before issuing the private link', async () => {
    const ports = createFamilyReunificationPorts();
    const flowContext: Extract<TelegramFlowContext, { sourceIntent: 'family_reunification' }> = {
      sourceIntent: 'family_reunification',
      preferredLocale: 'en',
      facts: { action: 'search', relationshipHint: 'parent', urgencyHint: 'normal' },
      prefill: { action: 'search', relationshipHint: 'parent', urgencyHint: 'normal' },
      confidence: 0.93,
    };

    const first = await advanceNaturalFamilyReunification(
      ['I am looking for Minor Full Name, phone +1 555 0100, blue jacket near the north gate.'],
      flowContext,
      ports,
    );

    expect(first.state.step).toBe('awaitingIncident');
    expect(first.responseText).toContain('I recognized a family reunification request');
    expect(first.responseText).toContain('private web channel');
    expect(first.responseText).toContain('Choose an incident');
    expect(first.responseText).not.toContain('Minor Full Name');
    expect(first.responseText).not.toContain('+1 555 0100');
    expect(first.responseText).not.toContain('blue jacket');
    expect(first.responseText).not.toContain('north gate');
    expect(first.responseText).not.toContain('parent');
    expect(ports.createPrivateLink).not.toHaveBeenCalled();

    const second = await handleTelegramFamilyReunificationFlow(first.state, telegramUserUpdate('1'), ports);

    expect(second.state.step).toBe('linked');
    expect(second.responseText).toContain('https://safe.example/family-reunification');
    expect(second.responseText).not.toContain('Minor Full Name');
    expect(second.responseText).not.toContain('+1 555 0100');
    expect(second.responseText).not.toContain('blue jacket');
    expect(second.responseText).not.toContain('north gate');
    expect(ports.createPrivateLink).toHaveBeenCalledWith('incident-zc-demo', expect.objectContaining({
      scope: 'family_reunification.search',
      channel: 'web-ui',
      maxUses: 1,
    }));
  });

  it('persists a changed locale during an active family reunification flow for subsequent copy', async () => {
    const ports = createFamilyReunificationPorts();
    let state: TelegramFamilyReunificationState = { step: 'idle' };

    let result = await handleTelegramFamilyReunificationFlow(state, telegramUserUpdate('/familia', 'es'), ports);
    state = result.state;

    result = await handleTelegramFamilyReunificationFlow(state, telegramUserUpdate('/language en', 'es'), ports);
    expect(result.responseText).toContain('Language updated');
    expect(result.state).toMatchObject({ step: 'awaitingIncident', preferredLocale: 'en' });
    state = result.state;

    result = await handleTelegramFamilyReunificationFlow(state, telegramUserUpdate('missing-incident', 'es'), ports);
    expect(result.responseText).toContain('Incident not found');
    expect(result.responseText).not.toContain('Incidente no encontrado');
  });

  it('does not echo sensitive family details in Telegram while selecting the incident', async () => {
    const ports = createFamilyReunificationPorts();
    const { state, responseText } = await advanceFamilyReunification(['/reunificacion', 'Minor Full Name, photo, exact address'], ports);

    expect(state.step).toBe('awaitingIncident');
    expect(responseText).toContain('Incident not found');
    expect(responseText).not.toContain('Minor Full Name');
    expect(responseText).not.toContain('exact address');
    expect(ports.createPrivateLink).not.toHaveBeenCalled();
  });

  it('falls back to in-person verification when private link issuance fails', async () => {
    const ports = createFamilyReunificationPorts({
      createPrivateLink: vi.fn().mockRejectedValue(new Error('backend unavailable')),
    });
    const { state, responseText } = await advanceFamilyReunification(['/familia', 'incident-zc-demo'], ports);

    expect(state.step).toBe('awaitingIncident');
    expect(responseText).toContain('Could not create a private family reunification link');
    expect(responseText).toContain('family reunification desk');
    expect(responseText).toContain('Do not send names');
    expect(responseText).toContain('phone numbers');
  });

});


describe('telegram channel telemetry', () => {
  it('emits sanitized command telemetry without Telegram identifiers or message text', async () => {
    const events: unknown[] = [];

    const result = handleTelegramWebhookUpdate(telegramUserUpdate('/sos secret text'), {
      telemetry: {
        emit: (event) => {
          events.push(event);
        },
      },
    });

    await Promise.resolve();

    expect(result.accepted).toBe(true);
    expect(events).toEqual([
      expect.objectContaining({
        event: 'operation.processed',
        category: 'sync',
        result: 'accepted',
        channel: 'telegram',
        scope: 'telegram.command',
        action: '/sos',
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain('1001');
    expect(JSON.stringify(events)).not.toContain('Field');
    expect(JSON.stringify(events)).not.toContain('secret text');
  });

  it('does not block Telegram flow completion when telemetry sink fails', async () => {
    const ports = createSosPorts({
      telemetry: {
        emit: vi.fn().mockRejectedValue(new Error('telemetry unavailable')),
      },
    });

    const { state, responseText } = await advanceSos(['/sos', '1', 'CONFIRM SOS'], ports);
    await Promise.resolve();

    expect(state.step).toBe('submitted');
    expect(responseText).toContain('Backend recording confirmed only');
    expect(ports.telemetry?.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'operation.processed',
        channel: 'telegram',
        scope: 'telegram.sos',
        result: 'accepted',
        action: 'awaitingConfirmation->submitted',
      }),
    );
  });
});
