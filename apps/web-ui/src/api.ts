import {
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  HealthResponseSchema,
  ResourceReportListResponseSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
  type DispatchTaskConnectedUpdateRequest,
  type DispatchTaskListResponse,
  type DispatchTaskResponse,
  type HealthResponse,
  type ResourceReportListResponse,
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


export async function fetchResourceReports(incidentId: string, fetcher: Fetcher = fetch): Promise<ResourceReportListResponse> {
  const response = await fetcher(`${getApiBaseUrl()}${resourceReportCollectionPath(incidentId)}`);

  if (!response.ok) {
    throw new Error(`Resource report list failed with status ${response.status}`);
  }

  return ResourceReportListResponseSchema.parse(await response.json());
}

export async function fetchDispatchTasks(incidentId: string, fetcher: Fetcher = fetch): Promise<DispatchTaskListResponse> {
  const response = await fetcher(`${getApiBaseUrl()}${dispatchTaskCollectionPath(incidentId)}`);

  if (!response.ok) {
    throw new Error(`Dispatch task list failed with status ${response.status}`);
  }

  return DispatchTaskListResponseSchema.parse(await response.json());
}

export async function updateDispatchTask(
  incidentId: string,
  dispatchTaskId: string,
  request: DispatchTaskConnectedUpdateRequest,
  fetcher: Fetcher = fetch,
): Promise<DispatchTaskResponse> {
  const payload = DispatchTaskConnectedUpdateRequestSchema.parse(request);
  const response = await fetcher(`${getApiBaseUrl()}${dispatchTaskDetailPath(incidentId, dispatchTaskId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Dispatch task update failed with status ${response.status}`);
  }

  return DispatchTaskResponseSchema.parse(await response.json());
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


function resourceReportCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/resource-reports`;
}

function dispatchTaskCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/dispatch-tasks`;
}

function dispatchTaskDetailPath(incidentId: string, dispatchTaskId: string): string {
  return `${dispatchTaskCollectionPath(incidentId)}/${encodeURIComponent(dispatchTaskId)}`;
}
