import {
  HealthResponseSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
  type HealthResponse,
  type WorkCenterConnectedCreateRequest,
  type WorkCenterCreateResponse,
  type WorkCenterDetailResponse,
  type WorkCenterListResponse,
} from '@zona-cero/contracts';

const defaultApiBaseUrl = 'http://127.0.0.1:8787';

type Fetcher = typeof fetch;

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;
}

export async function fetchApiHealth(fetcher: Fetcher = fetch): Promise<HealthResponse> {
  const response = await fetcher(`${getApiBaseUrl()}/health`);

  if (!response.ok) {
    throw new Error(`Healthcheck failed with status ${response.status}`);
  }

  return HealthResponseSchema.parse(await response.json());
}

export async function fetchWorkCenters(incidentId: string, fetcher: Fetcher = fetch): Promise<WorkCenterListResponse> {
  const response = await fetcher(`${getApiBaseUrl()}${workCenterCollectionPath(incidentId)}`);

  if (!response.ok) {
    throw new Error(`Work center list failed with status ${response.status}`);
  }

  return WorkCenterListResponseSchema.parse(await response.json());
}

export async function fetchWorkCenterDetail(
  incidentId: string,
  workCenterId: string,
  fetcher: Fetcher = fetch,
): Promise<WorkCenterDetailResponse> {
  const response = await fetcher(`${getApiBaseUrl()}${workCenterDetailPath(incidentId, workCenterId)}`);

  if (!response.ok) {
    throw new Error(`Work center detail failed with status ${response.status}`);
  }

  return WorkCenterDetailResponseSchema.parse(await response.json());
}

export async function createWorkCenter(
  incidentId: string,
  request: WorkCenterConnectedCreateRequest,
  fetcher: Fetcher = fetch,
): Promise<WorkCenterCreateResponse> {
  const payload = WorkCenterConnectedCreateRequestSchema.parse(request);
  const response = await fetcher(`${getApiBaseUrl()}${workCenterCollectionPath(incidentId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Work center creation failed with status ${response.status}`);
  }

  return WorkCenterCreateResponseSchema.parse(await response.json());
}

function workCenterCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/work-centers`;
}

function workCenterDetailPath(incidentId: string, workCenterId: string): string {
  return `${workCenterCollectionPath(incidentId)}/${encodeURIComponent(workCenterId)}`;
}
