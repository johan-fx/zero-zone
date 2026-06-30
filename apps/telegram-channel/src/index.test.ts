import { describe, expect, it, vi } from 'vitest';

import {
  incidentConfigHappyFixture,
  incidentListHappyFixture,
  telegramIncidentJoinResponseFixture,
  telegramStartUpdateFixture,
} from '@zona-cero/testing';
import {
  handleTelegramIncidentJoinFlow,
  handleTelegramWebhookUpdate,
  resolveTelegramCommand,
  type TelegramIncidentJoinPorts,
  type TelegramIncidentJoinState,
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
});
