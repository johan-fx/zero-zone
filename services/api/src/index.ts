import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { HealthResponseSchema, SyncPushRequestSchema, type SyncPushResponse } from '@zona-cero/contracts';
import { handleTelegramWebhookUpdate, type TelegramUpdateLike } from '@zona-cero/telegram-channel';

export class IncidentCellObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(): Promise<Response> {
    return Response.json({ ok: true, storage: 'durable-object-sqlite', id: this.state.id.toString() });
  }
}

export const app = new Hono<{ Bindings: Env }>();

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
  return c.json(handleTelegramWebhookUpdate(update));
});

export default app;
