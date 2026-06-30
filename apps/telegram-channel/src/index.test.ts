import { describe, expect, it, vi } from 'vitest';

import {
  incidentConfigHappyFixture,
  incidentListHappyFixture,
  telegramIncidentJoinResponseFixture,
  telegramStartUpdateFixture,
  telegramWorkCenterCreateRequestFixture,
  validWorkCenterCreatePayloadFixture,
  workCenterCreateResponseHappyFixture,
} from '@zona-cero/testing';
import { WorkCenterConnectedCreateRequestSchema } from '@zona-cero/contracts';
import {
  TelegramIncidentJoinStateSchema,
  TelegramWorkCenterReportStateSchema,
  handleTelegramIncidentJoinFlow,
  handleTelegramWorkCenterReportFlow,
  handleTelegramWebhookUpdate,
  isTerminalTelegramIncidentJoinState,
  isTerminalTelegramWorkCenterReportState,
  parseTelegramIncidentJoinState,
  parseTelegramWorkCenterReportState,
  resolveTelegramCommand,
  safeParseTelegramIncidentJoinState,
  safeParseTelegramWorkCenterReportState,
  type TelegramIncidentJoinPorts,
  type TelegramIncidentJoinState,
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

const validJoinStates = [
  { step: 'idle' },
  { step: 'awaitingIncident', incidents: incidentListHappyFixture.incidents, externalUserId: '1001' },
  { step: 'awaitingPseudonym', incident: incidentListHappyFixture.incidents[0], externalUserId: '1001' },
  { step: 'awaitingRole', config: incidentConfigHappyFixture, externalUserId: '1001', pseudonym: 'Field Telegram' },
  { step: 'joined', response: telegramIncidentJoinResponseFixture },
  { step: 'cancelled' },
] satisfies TelegramIncidentJoinState[];

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
});
