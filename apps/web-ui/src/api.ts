import {
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  FamilyReunificationSearchRequestSchema,
  FamilyReunificationSearchResponseSchema,
  CountryListResponseSchema,
  HealthResponseSchema,
  PrivateWebLinkConsumeRequestSchema,
  OperationalMapResponseSchema,
  OperationalUpdateActionRequestSchema,
  OperationalUpdateActionResponseSchema,
  OperationalUpdateCorroborateRequestSchema,
  OperationalUpdateDisputeRequestSchema,
  OperationalUpdateLinkRequestSchema,
  OperationalUpdateLinkResponseSchema,
  OperationalUpdatePullResponseSchema,
  PrivateWebLinkConsumeResponseSchema,
  PrivateWebLinkValidateRequestSchema,
  PrivateWebLinkValidateResponseSchema,
  DisputeCreateRequestSchema,
  DisputeCreateResponseSchema,
  ResourceReportListResponseSchema,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
  SosConnectedCreateRequestSchema,
  SyncPullResponseSchema,
  TrustSignalCreateRequestSchema,
  TrustSignalCreateResponseSchema,
  TrustStateResponseSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
  type DispatchTaskConnectedUpdateRequest,
  type DispatchTaskListResponse,
  type DispatchTaskResponse,
  type FamilyReunificationSearchRequest,
  type FamilyReunificationSearchResponse,
  type CountryListResponse,
  type HealthResponse,
  type OperationalMapResponse,
  type OperationalUpdateActionRequest,
  type OperationalUpdateActionResponse,
  type OperationalUpdateCorroborateRequest,
  type OperationalUpdateDisputeRequest,
  type OperationalUpdateLinkRequest,
  type OperationalUpdateLinkResponse,
  type OperationalUpdatePullResponse,
  type PrivateWebLinkConsumeRequest,
  type PrivateWebLinkConsumeResponse,
  type PrivateWebLinkValidateRequest,
  type PrivateWebLinkValidateResponse,
  type DisputeCreateRequest,
  type DisputeCreateResponse,
  type ResourceReportListResponse,
  type SosAlertCreateResponse,
  type SosAlertStatusResponse,
  type SosConnectedCreateRequest,
  type SyncFreshness,
  type TrustSignalCreateRequest,
  type TrustSignalCreateResponse,
  type TrustStateResponse,
  type TrustSubject,
  type WorkCenterConnectedCreateRequest,
  type WorkCenterCreateResponse,
  type WorkCenterDetailResponse,
  type WorkCenterListResponse,
} from "@zona-cero/contracts";

const defaultApiBaseUrl = "http://127.0.0.1:8787";

type Fetcher = typeof fetch;

export type TurnstileForwardingOptions = {
  turnstileToken?: string | null;
};

export function createTurnstileHeaders(
  options: TurnstileForwardingOptions = {},
): Record<string, string> {
  const token = options.turnstileToken?.trim();
  return token ? { "cf-turnstile-response": token } : {};
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;
}

export async function fetchApiHealth(
  fetcher: Fetcher = fetch,
): Promise<HealthResponse> {
  const response = await fetcher(`${getApiBaseUrl()}/health`);

  if (!response.ok) {
    throw new Error(`Healthcheck failed with status ${response.status}`);
  }

  return HealthResponseSchema.parse(await response.json());
}

export async function fetchMapCountries(
  fetcher: Fetcher = fetch,
): Promise<CountryListResponse> {
  const response = await fetcher(`${getApiBaseUrl()}/map/countries`);

  if (!response.ok) {
    throw new Error(`Map countries failed with status ${response.status}`);
  }

  return CountryListResponseSchema.parse(await response.json());
}

export async function fetchOperationalMap(
  countryCode: string,
  fetcher: Fetcher = fetch,
): Promise<OperationalMapResponse> {
  const params = new URLSearchParams({ countryCode });
  const response = await fetcher(`${getApiBaseUrl()}/map?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Operational map failed with status ${response.status}`);
  }

  return OperationalMapResponseSchema.parse(await response.json());
}

export async function fetchOperationalUpdates(
  incidentId: string,
  cellId: string,
  options: { cursor?: string | null; limit?: number; channel?: "web-ui"; externalId?: string } = {},
  fetcher: Fetcher = fetch,
): Promise<OperationalUpdatePullResponse> {
  const params = new URLSearchParams();
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.channel) params.set("channel", options.channel);
  if (options.externalId) params.set("externalId", options.externalId);
  const query = params.toString();
  const response = await fetcher(
    `${getApiBaseUrl()}${operationalUpdatesPath(incidentId, cellId)}${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    throw new Error(`Operational updates failed with status ${response.status}`);
  }

  return OperationalUpdatePullResponseSchema.parse(await response.json());
}

export async function acknowledgeOperationalUpdate(
  incidentId: string,
  updateId: string,
  request: OperationalUpdateActionRequest,
  fetcher: Fetcher = fetch,
): Promise<OperationalUpdateActionResponse> {
  return postOperationalUpdateAction(
    incidentId,
    updateId,
    "ack",
    OperationalUpdateActionRequestSchema.parse(request),
    OperationalUpdateActionResponseSchema,
    fetcher,
  );
}

export async function readOperationalUpdate(
  incidentId: string,
  updateId: string,
  request: OperationalUpdateActionRequest,
  fetcher: Fetcher = fetch,
): Promise<OperationalUpdateActionResponse> {
  return postOperationalUpdateAction(
    incidentId,
    updateId,
    "read",
    OperationalUpdateActionRequestSchema.parse(request),
    OperationalUpdateActionResponseSchema,
    fetcher,
  );
}

export async function openOperationalUpdate(
  incidentId: string,
  updateId: string,
  request: OperationalUpdateActionRequest,
  fetcher: Fetcher = fetch,
): Promise<OperationalUpdateActionResponse> {
  return postOperationalUpdateAction(
    incidentId,
    updateId,
    "open",
    OperationalUpdateActionRequestSchema.parse(request),
    OperationalUpdateActionResponseSchema,
    fetcher,
  );
}

export async function corroborateOperationalUpdate(
  incidentId: string,
  updateId: string,
  request: OperationalUpdateCorroborateRequest,
  fetcher: Fetcher = fetch,
): Promise<OperationalUpdateActionResponse> {
  return postOperationalUpdateAction(
    incidentId,
    updateId,
    "corroborate",
    OperationalUpdateCorroborateRequestSchema.parse(request),
    OperationalUpdateActionResponseSchema,
    fetcher,
  );
}

export async function disputeOperationalUpdate(
  incidentId: string,
  updateId: string,
  request: OperationalUpdateDisputeRequest,
  fetcher: Fetcher = fetch,
): Promise<OperationalUpdateActionResponse> {
  return postOperationalUpdateAction(
    incidentId,
    updateId,
    "dispute",
    OperationalUpdateDisputeRequestSchema.parse(request),
    OperationalUpdateActionResponseSchema,
    fetcher,
  );
}

export async function createOperationalUpdateLink(
  incidentId: string,
  updateId: string,
  request: OperationalUpdateLinkRequest,
  fetcher: Fetcher = fetch,
): Promise<OperationalUpdateLinkResponse> {
  return postOperationalUpdateAction(
    incidentId,
    updateId,
    "links",
    OperationalUpdateLinkRequestSchema.parse(request),
    OperationalUpdateLinkResponseSchema,
    fetcher,
  );
}

export async function fetchWorkCenters(
  incidentId: string,
  fetcher: Fetcher = fetch,
): Promise<WorkCenterListResponse> {
  const response = await fetcher(
    `${getApiBaseUrl()}${workCenterCollectionPath(incidentId)}`,
  );

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
  const response = await fetcher(
    `${getApiBaseUrl()}${workCenterDetailPath(incidentId, workCenterId)}`,
  );

  if (!response.ok) {
    throw new Error(`Work center detail failed with status ${response.status}`);
  }

  return WorkCenterDetailResponseSchema.parse(await response.json());
}

export async function fetchResourceReports(
  incidentId: string,
  fetcher: Fetcher = fetch,
): Promise<ResourceReportListResponse> {
  const response = await fetcher(
    `${getApiBaseUrl()}${resourceReportCollectionPath(incidentId)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Resource report list failed with status ${response.status}`,
    );
  }

  return ResourceReportListResponseSchema.parse(await response.json());
}

export async function fetchDispatchTasks(
  incidentId: string,
  fetcher: Fetcher = fetch,
): Promise<DispatchTaskListResponse> {
  const response = await fetcher(
    `${getApiBaseUrl()}${dispatchTaskCollectionPath(incidentId)}`,
  );

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
  const response = await fetcher(
    `${getApiBaseUrl()}${dispatchTaskDetailPath(incidentId, dispatchTaskId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Dispatch task update failed with status ${response.status}`,
    );
  }

  return DispatchTaskResponseSchema.parse(await response.json());
}

export async function fetchSosStatus(
  incidentId: string,
  fetcher: Fetcher = fetch,
): Promise<SosAlertStatusResponse> {
  const response = await fetcher(
    `${getApiBaseUrl()}${sosCollectionPath(incidentId)}`,
  );

  if (!response.ok) {
    throw new Error(`SOS status failed with status ${response.status}`);
  }

  return SosAlertStatusResponseSchema.parse(await response.json());
}

export async function fetchTrustState(
  incidentId: string,
  subject: Pick<TrustSubject, "entityType" | "entityId">,
  fetcher: Fetcher = fetch,
): Promise<TrustStateResponse> {
  const params = new URLSearchParams({
    entityType: subject.entityType,
    entityId: subject.entityId,
  });
  const response = await fetcher(
    `${getApiBaseUrl()}${trustStatePath(incidentId)}?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Trust state failed with status ${response.status}`);
  }

  return TrustStateResponseSchema.parse(await response.json());
}

export async function createTrustSignal(
  incidentId: string,
  request: TrustSignalCreateRequest,
  fetcher: Fetcher = fetch,
): Promise<TrustSignalCreateResponse> {
  const payload = TrustSignalCreateRequestSchema.parse(request);
  const response = await fetcher(
    `${getApiBaseUrl()}${trustSignalCollectionPath(incidentId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Trust signal failed with status ${response.status}`);
  }

  return TrustSignalCreateResponseSchema.parse(await response.json());
}

export async function createDispute(
  incidentId: string,
  request: DisputeCreateRequest,
  fetcher: Fetcher = fetch,
): Promise<DisputeCreateResponse> {
  const payload = DisputeCreateRequestSchema.parse(request);
  const response = await fetcher(
    `${getApiBaseUrl()}${disputeCollectionPath(incidentId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Dispute failed with status ${response.status}`);
  }

  return DisputeCreateResponseSchema.parse(await response.json());
}

export async function createSosAlert(
  incidentId: string,
  request: SosConnectedCreateRequest,
  fetcher: Fetcher = fetch,
): Promise<SosAlertCreateResponse> {
  const payload = SosConnectedCreateRequestSchema.parse(request);
  const response = await fetcher(
    `${getApiBaseUrl()}${sosCollectionPath(incidentId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`SOS creation failed with status ${response.status}`);
  }

  return SosAlertCreateResponseSchema.parse(await response.json());
}

export async function fetchSyncFreshness(
  incidentId: string,
  cellId: string,
  fetcher: Fetcher = fetch,
): Promise<SyncFreshness> {
  const response = await fetcher(
    `${getApiBaseUrl()}${syncPullPath(incidentId, cellId)}?limit=1`,
  );

  if (!response.ok) {
    throw new Error(`Sync freshness failed with status ${response.status}`);
  }

  return SyncPullResponseSchema.parse(await response.json()).freshness;
}

export async function createWorkCenter(
  incidentId: string,
  request: WorkCenterConnectedCreateRequest,
  fetcher: Fetcher = fetch,
): Promise<WorkCenterCreateResponse> {
  const payload = WorkCenterConnectedCreateRequestSchema.parse(request);
  const response = await fetcher(
    `${getApiBaseUrl()}${workCenterCollectionPath(incidentId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Work center creation failed with status ${response.status}`,
    );
  }

  return WorkCenterCreateResponseSchema.parse(await response.json());
}

export async function validatePrivateFamilyReunificationLink(
  request: PrivateWebLinkValidateRequest,
  fetcher: Fetcher = fetch,
  options: TurnstileForwardingOptions = {},
): Promise<PrivateWebLinkValidateResponse> {
  const payload = PrivateWebLinkValidateRequestSchema.parse(request);
  const response = await fetcher(`${getApiBaseUrl()}/private-links/validate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createTurnstileHeaders(options),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Private link validation failed with status ${response.status}`,
      ),
    );
  }

  return PrivateWebLinkValidateResponseSchema.parse(await response.json());
}

export async function searchFamilyReunification(
  request: FamilyReunificationSearchRequest,
  fetcher: Fetcher = fetch,
  options: TurnstileForwardingOptions = {},
): Promise<FamilyReunificationSearchResponse> {
  const payload = FamilyReunificationSearchRequestSchema.parse(request);
  const response = await fetcher(
    `${getApiBaseUrl()}/private-links/family-reunification/search`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...createTurnstileHeaders(options),
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Family reunification search failed with status ${response.status}`,
      ),
    );
  }

  return FamilyReunificationSearchResponseSchema.parse(await response.json());
}

export async function consumePrivateFamilyReunificationLink(
  request: PrivateWebLinkConsumeRequest,
  fetcher: Fetcher = fetch,
  options: TurnstileForwardingOptions = {},
): Promise<PrivateWebLinkConsumeResponse> {
  const payload = PrivateWebLinkConsumeRequestSchema.parse(request);
  const response = await fetcher(`${getApiBaseUrl()}/private-links/consume`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createTurnstileHeaders(options),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        `Private link consumption failed with status ${response.status}`,
      ),
    );
  }

  return PrivateWebLinkConsumeResponseSchema.parse(await response.json());
}

function syncPullPath(incidentId: string, cellId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/cells/${encodeURIComponent(cellId)}/sync/pull`;
}

function operationalUpdatesPath(incidentId: string, cellId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/cells/${encodeURIComponent(cellId)}/updates`;
}

function operationalUpdateActionPath(
  incidentId: string,
  updateId: string,
  action: "ack" | "read" | "open" | "corroborate" | "dispute" | "links",
): string {
  return `/incidents/${encodeURIComponent(incidentId)}/updates/${encodeURIComponent(updateId)}/${action}`;
}

function workCenterCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/work-centers`;
}

function workCenterDetailPath(
  incidentId: string,
  workCenterId: string,
): string {
  return `${workCenterCollectionPath(incidentId)}/${encodeURIComponent(workCenterId)}`;
}

function resourceReportCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/resource-reports`;
}

function dispatchTaskCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/dispatch-tasks`;
}

function dispatchTaskDetailPath(
  incidentId: string,
  dispatchTaskId: string,
): string {
  return `${dispatchTaskCollectionPath(incidentId)}/${encodeURIComponent(dispatchTaskId)}`;
}

function sosCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/sos`;
}

function trustStatePath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/trust-state`;
}

function trustSignalCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/trust-signals`;
}

function disputeCollectionPath(incidentId: string): string {
  return `/incidents/${encodeURIComponent(incidentId)}/disputes`;
}

async function readApiError(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = await response.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return fallback;
}

async function postOperationalUpdateAction<T>(
  incidentId: string,
  updateId: string,
  action: "ack" | "read" | "open" | "corroborate" | "dispute" | "links",
  payload: OperationalUpdateActionRequest,
  schema: { parse(value: unknown): T },
  fetcher: Fetcher,
): Promise<T> {
  const response = await fetcher(
    `${getApiBaseUrl()}${operationalUpdateActionPath(incidentId, updateId, action)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Operational update action failed with status ${response.status}`);
  }

  return schema.parse(await response.json());
}
