import {
  SyncPullResponseSchema,
  SyncPushResponseSchema,
  type SignedOperation,
  type SyncPullResponse,
  type SyncPushResponse,
} from '@zona-cero/contracts';

export type ScopedSyncRequest = {
  incidentId: string;
  cellId: string;
};

export type SyncPushInput = ScopedSyncRequest & {
  operations: SignedOperation[];
  cursor?: string | null;
};

export type SyncPullInput = ScopedSyncRequest & {
  cursor?: string | null;
  limit?: number;
};

export type ScopedSyncClient = {
  push(input: SyncPushInput): Promise<SyncPushResponse>;
  pull(input: SyncPullInput): Promise<SyncPullResponse>;
};

export type CreateHttpScopedSyncClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
};

export function createHttpScopedSyncClient({ baseUrl, fetchImpl = fetch, headers }: CreateHttpScopedSyncClientOptions): ScopedSyncClient {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return {
    async push(input) {
      const response = await fetchImpl(`${normalizedBaseUrl}${syncScopePath(input)}/sync/push`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(await resolveHeaders(headers)),
        },
        body: JSON.stringify({ operations: input.operations, cursor: input.cursor ?? null }),
      });

      const body = await readJsonResponse(response);
      return SyncPushResponseSchema.parse(body);
    },

    async pull(input) {
      const params = new URLSearchParams();
      if (input.cursor) {
        params.set('cursor', input.cursor);
      }
      if (input.limit) {
        params.set('limit', String(input.limit));
      }

      const query = params.toString();
      const response = await fetchImpl(`${normalizedBaseUrl}${syncScopePath(input)}/sync/pull${query ? `?${query}` : ''}`, {
        method: 'GET',
        headers: await resolveHeaders(headers),
      });

      const body = await readJsonResponse(response);
      return SyncPullResponseSchema.parse(body);
    },
  };
}

function syncScopePath(input: ScopedSyncRequest): string {
  return `/incidents/${encodeURIComponent(input.incidentId)}/cells/${encodeURIComponent(input.cellId)}`;
}

async function resolveHeaders(headers: CreateHttpScopedSyncClientOptions['headers']): Promise<HeadersInit> {
  return typeof headers === 'function' ? headers() : headers ?? {};
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `Sync request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return body;
}
