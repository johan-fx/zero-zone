import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  HealthResponseSchema,
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  IncidentJoinResponseSchema,
  IncidentListResponseSchema,
  type Channel,
  type IncidentConfigResponse,
  type IncidentJoinResponse,
  type IncidentRole,
  type IncidentSummary,
  type PermissionSnapshot,
  SyncPushRequestSchema,
  type SyncPushResponse,
  TelegramWebhookResultSchema,
} from '@zona-cero/contracts';
import {
  handleTelegramIncidentJoinFlow,
  resolveTelegramCommand,
  type TelegramIncidentJoinPorts,
  type TelegramIncidentJoinState,
  type TelegramUpdateLike,
} from '@zona-cero/telegram-channel';

export class IncidentCellObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(): Promise<Response> {
    return Response.json({ ok: true, storage: 'durable-object-sqlite', id: this.state.id.toString() });
  }
}

export const app = new Hono<{ Bindings: Env }>();

const roles: IncidentRole[] = ['volunteer', 'coordinator', 'logistics', 'medical'];
const channels: Channel[] = ['telegram', 'mobile', 'web-ui'];
// Minimal in-process conversation state for the Slice 2 webhook path.
// Durable/remote storage is intentionally deferred; Worker isolates may evict this map.
const telegramConversationStates = new Map<string, TelegramIncidentJoinState>();

const permissionSnapshots: IncidentConfigResponse['permissionSnapshots'] = {
  volunteer: {
    canReadIncident: true,
    canJoinIncident: true,
    canManageIncident: false,
    canManageLogistics: false,
    canManageMedical: false,
  },
  coordinator: {
    canReadIncident: true,
    canJoinIncident: true,
    canManageIncident: true,
    canManageLogistics: true,
    canManageMedical: true,
  },
  logistics: {
    canReadIncident: true,
    canJoinIncident: true,
    canManageIncident: false,
    canManageLogistics: true,
    canManageMedical: false,
  },
  medical: {
    canReadIncident: true,
    canJoinIncident: true,
    canManageIncident: false,
    canManageLogistics: false,
    canManageMedical: true,
  },
};

app.use('*', cors());

app.get('/health', (c) => {
  return c.json(
    HealthResponseSchema.parse({
      service: 'zona-cero-api',
      ok: true,
      version: c.env.API_VERSION ?? '0.0.0-boilerplate',
    }),
  );
});

app.get('/incidents', async (c) => {
  await ensureIncidentStore(c.env.DB);
  const results = await listIncidents(c.env.DB);

  return c.json(IncidentListResponseSchema.parse({ incidents: results }));
});

app.get('/incidents/:incidentId/config', async (c) => {
  await ensureIncidentStore(c.env.DB);
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));

  if (!incident) {
    return c.json({ error: 'incident_not_found' }, 404);
  }

  return c.json(IncidentConfigResponseSchema.parse({ incident, roles, channels, permissionSnapshots }));
});

app.post('/incidents/:incidentId/join', async (c) => {
  await ensureIncidentStore(c.env.DB);
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));

  if (!incident) {
    return c.json({ error: 'incident_not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = IncidentJoinRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const response = await joinIncident(c.env.DB, incident, parsed.data);
  return c.json(IncidentJoinResponseSchema.parse(response));
});

app.post('/sync/push', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SyncPushRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const response: SyncPushResponse = {
    results: parsed.data.operations.map((operation) => ({ opId: operation.opId, status: 'accepted' })),
  };

  return c.json(response);
});

app.get('/sync/pull', (c) => {
  return c.json({ operations: [], cursor: c.req.query('cursor') ?? null });
});

app.post('/telegram/webhook', async (c) => {
  const update = (await c.req.json().catch(() => ({}))) as TelegramUpdateLike;
  await ensureIncidentStore(c.env.DB);

  const stateKey = getTelegramConversationStateKey(update);
  const currentState: TelegramIncidentJoinState = stateKey ? (telegramConversationStates.get(stateKey) ?? { step: 'idle' }) : { step: 'idle' };
  const ports = createTelegramIncidentJoinPorts(c.env.DB);
  const result = await handleTelegramIncidentJoinFlow(currentState, update, ports);

  if (stateKey) {
    telegramConversationStates.set(stateKey, result.state);
  }

  return c.json(
    TelegramWebhookResultSchema.parse({
      accepted: true,
      command: resolveTelegramCommand(update),
      responseText: result.responseText,
    }),
  );
});

async function ensureIncidentStore(db: D1Database): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS incidents (incident_id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active', 'closed')), starts_at TEXT NOT NULL, location_name TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS channel_identities (channel_identity_id TEXT PRIMARY KEY, channel TEXT NOT NULL CHECK (channel IN ('telegram', 'mobile', 'web-ui')), external_id TEXT NOT NULL, display_name TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (channel, external_id))`,
    `CREATE TABLE IF NOT EXISTS incident_memberships (incident_membership_id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(incident_id), channel_identity_id TEXT NOT NULL REFERENCES channel_identities(channel_identity_id), role TEXT NOT NULL CHECK (role IN ('volunteer', 'coordinator', 'logistics', 'medical')), permissions_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (incident_id, channel_identity_id, role))`,
    `CREATE TABLE IF NOT EXISTS audit_events (audit_event_id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(incident_id), channel_identity_id TEXT NOT NULL REFERENCES channel_identities(channel_identity_id), incident_membership_id TEXT NOT NULL REFERENCES incident_memberships(incident_membership_id), event_type TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, payload_json TEXT NOT NULL)`,
  ];

  for (const statement of statements) {
    await db.exec(statement);
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO incidents (incident_id, name, status, starts_at, location_name)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind('incident-zc-demo', 'Zona Cero Demo Incident', 'active', '2026-06-30T09:00:00.000Z', 'Operations Base')
    .run();
}

async function findIncident(db: D1Database, incidentId: string): Promise<IncidentSummary | null> {
  return db
    .prepare('SELECT incident_id AS incidentId, name, status, starts_at AS startsAt, location_name AS locationName FROM incidents WHERE incident_id = ?')
    .bind(incidentId)
    .first<IncidentSummary>();
}

async function listIncidents(db: D1Database): Promise<IncidentSummary[]> {
  const { results } = await db
    .prepare(
      'SELECT incident_id AS incidentId, name, status, starts_at AS startsAt, location_name AS locationName FROM incidents ORDER BY starts_at DESC',
    )
    .all<IncidentSummary>();

  return results;
}

function createIncidentConfigResponse(incident: IncidentSummary): IncidentConfigResponse {
  return IncidentConfigResponseSchema.parse({ incident, roles, channels, permissionSnapshots });
}

function createTelegramIncidentJoinPorts(db: D1Database): TelegramIncidentJoinPorts {
  return {
    async listIncidents() {
      return IncidentListResponseSchema.parse({ incidents: await listIncidents(db) });
    },
    async getIncidentConfig(incidentId) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw new Error(`Incident not found: ${incidentId}`);
      }

      return createIncidentConfigResponse(incident);
    },
    async joinIncident(incidentId, request) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw new Error(`Incident not found: ${incidentId}`);
      }

      return IncidentJoinResponseSchema.parse(await joinIncident(db, incident, request));
    },
  };
}

function getTelegramConversationStateKey(update: TelegramUpdateLike): string | null {
  const chatId = update.message?.chat?.id;
  const fromId = update.message?.from?.id;

  if (chatId == null && fromId == null) {
    return null;
  }

  return `chat:${chatId ?? 'unknown'}:from:${fromId ?? 'unknown'}`;
}

async function joinIncident(
  db: D1Database,
  incident: IncidentSummary,
  request: { channel: Channel; externalId: string; role: IncidentRole; displayName?: string },
): Promise<IncidentJoinResponse> {
  const channelIdentityId = `chid_${slug(request.channel)}_${slug(request.externalId)}`;
  const permissions: PermissionSnapshot = permissionSnapshots[request.role];
  const incidentMembershipId = `mship_${slug(incident.incidentId)}_${channelIdentityId}_${request.role}`;
  const auditEventId = `audit_join_${slug(incident.incidentId)}_${channelIdentityId}_${request.role}`;

  await db
    .prepare(
      `INSERT OR IGNORE INTO channel_identities (channel_identity_id, channel, external_id, display_name)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(channelIdentityId, request.channel, request.externalId, request.displayName ?? null)
    .run();

  const membershipInsert = await db
    .prepare(
      `INSERT OR IGNORE INTO incident_memberships (incident_membership_id, incident_id, channel_identity_id, role, permissions_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(incidentMembershipId, incident.incidentId, channelIdentityId, request.role, JSON.stringify(permissions))
    .run();

  const idempotent = membershipInsert.meta.changes === 0;

  await db
    .prepare(
      `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      auditEventId,
      incident.incidentId,
      channelIdentityId,
      incidentMembershipId,
      'incident.joined',
      JSON.stringify({ channel: request.channel, externalId: request.externalId, role: request.role }),
    )
    .run();

  return {
    incident,
    channelIdentity: {
      channelIdentityId,
      channel: request.channel,
      externalId: request.externalId,
      ...(request.displayName ? { displayName: request.displayName } : {}),
    },
    membership: {
      incidentMembershipId,
      incidentId: incident.incidentId,
      channelIdentityId,
      role: request.role,
      permissions,
    },
    audit: { auditEventId },
    idempotent,
  };
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export default app;
