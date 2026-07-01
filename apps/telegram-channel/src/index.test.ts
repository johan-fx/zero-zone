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
  type TelegramIncidentJoinPorts,
  type TelegramResourceReportPorts,
  type TelegramResourceReportState,
  type TelegramIncidentJoinState,
  type TelegramSosPorts,
  type TelegramSosState,
  type TelegramWorkCenterReportPorts,
  type TelegramWorkCenterReportState,
} from './index';

const telegramUserUpdate = (text: string) => ({
  message: {
    text,
    from: { id: 1001, first_name: 'Field' },
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
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001' },
  { step: 'awaitingPseudonym', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001' },
  { step: 'awaitingRole', config: incidentConfigHappyFixture, externalUserId: '1001', pseudonym: 'Field Telegram' },
  { step: 'joined', response: telegramIncidentJoinResponseFixture },
  { step: 'cancelled' },
] satisfies TelegramIncidentJoinState[];


const validResourceStates = [
  { step: 'idle' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001', displayName: 'Field' },
  { step: 'awaitingKind', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001', displayName: 'Field' },
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
  { step: 'awaitingTask', incident: incidentListHappyFixture.incidents[0], tasks: [dispatchTaskFixture], externalUserId: '1001' },
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
): Promise<{ state: TelegramIncidentJoinState; responseText: string; ports: TelegramIncidentJoinPorts }> {
  let state: TelegramIncidentJoinState = { step: 'idle' };
  let responseText = '';

  for (const input of inputs) {
    const result = await handleTelegramIncidentJoinFlow(state, telegramUserUpdate(input), ports);
    state = result.state;
    responseText = result.responseText;
  }

  return { state, responseText, ports };
}


async function advanceResource(
  inputs: string[],
  ports = createResourcePorts(),
): Promise<{ state: TelegramResourceReportState; responseText: string; ports: TelegramResourceReportPorts }> {
  let state: TelegramResourceReportState = { step: 'idle' };
  let responseText = '';

  for (const input of inputs) {
    const result = await handleTelegramResourceReportFlow(state, telegramUserUpdate(input), ports);
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
    expect(result.responseText).toContain('Do not send photos');
    expect(result.responseText).toContain('exact locations');
    expect(result.responseText).toContain('full minor identities');
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
    });
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
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, status: 'stale' })).toContain('backend freshness is stale');
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, status: 'expired' })).toContain('backend freshness is expired');
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, status: 'missing', lastFreshAt: null, lastSyncedAt: null })).toContain('backend freshness is missing');
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, cursorLag: 2 })).toContain('2 backend updates may not be visible');
    expect(formatTelegramChannelLimitation({ ...freshSyncFreshnessFixture, hasConflicts: true })).toContain('sync conflicts need coordinator review');
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

  it('keeps resource report state and reports backend errors visibly', async () => {
    const ports = createResourcePorts({ createResourceReport: vi.fn().mockRejectedValue({ error: 'permission_denied' }) });
    const { state, responseText } = await advanceResource(['/resource', '1', 'surplus', 'blankets', '10 boxes', 'medium', 'skip', 'skip', 'yes'], ports);

    expect(state.step).toBe('awaitingConfirmation');
    expect(responseText).toContain('Permission denied');
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
    expect(responseText).toContain('no photos');
    expect(responseText).toContain('no exact location');
    expect(responseText).toContain('no full identity of minors');
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
    expect(responseText).toContain('Do not send photos');
  });

});
