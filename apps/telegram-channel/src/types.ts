import type { SupportedLocale } from '@zona-cero/i18n';

import type {
  DispatchTask,
  DispatchTaskConnectedUpdateRequest,
  DispatchTaskListResponse,
  DispatchTaskResponse,
  IncidentConfigResponse,
  IncidentJoinRequest,
  IncidentJoinResponse,
  IncidentListResponse,
  IncidentSummary,
  OperationalEvent,
  PrivateWebLinkIssueRequest,
  PrivateWebLinkIssueResponse,
  ResourceReportConnectedCreateRequest,
  ResourceReportCreateResponse,
  ResourceReportKind,
  ResourceReportUrgency,
  SosAlertCreateResponse,
  SosConnectedCreateRequest,
  SyncFreshness,
  TelegramDispatchIntentFacts,
  TelegramFamilyReunificationIntentFacts,
  TelegramIncidentJoinIntentFacts,
  TelegramResourceIntentFacts,
  TelegramSosIntentFacts,
  TelegramWorkCenterIntentFacts,
  WorkCenterConnectedCreateRequest,
  WorkCenterCreatePayload,
  WorkCenterCreateResponse,
} from '@zona-cero/contracts';

export type ChannelTelemetryPort = {
  emit(event: OperationalEvent): void | Promise<void>;
};

export type TelegramTelemetryOptions = {
  telemetry?: ChannelTelemetryPort;
};

export type TelegramTelemetryScope =
  | 'telegram.command'
  | 'telegram.incident_join'
  | 'telegram.work_center'
  | 'telegram.resource_report'
  | 'telegram.dispatch_task'
  | 'telegram.sos'
  | 'telegram.private_link';

export type TelegramNativeLocation = {
  latitude: number;
  longitude: number;
  horizontal_accuracy?: number;
};

export type TelegramUpdateLike = {
  message?: {
    text?: string;
    location?: TelegramNativeLocation;
    chat?: { id?: number | string; type?: string };
    from?: { id?: number | string; first_name?: string; language_code?: string };
  };
};

export type TelegramFlowContextSourceIntent = 'resource' | 'workcenter' | 'family_reunification' | 'sos' | 'dispatch' | 'incident_join';

export type TelegramFlowContextFactsByIntent = {
  resource: TelegramResourceIntentFacts;
  workcenter: TelegramWorkCenterIntentFacts;
  family_reunification: TelegramFamilyReunificationIntentFacts;
  sos: TelegramSosIntentFacts;
  dispatch: TelegramDispatchIntentFacts;
  incident_join: TelegramIncidentJoinIntentFacts;
};

export type TelegramFlowContext<TIntent extends TelegramFlowContextSourceIntent = TelegramFlowContextSourceIntent> = {
  [TSourceIntent in TIntent]: {
    preferredLocale: SupportedLocale;
    sourceIntent: TSourceIntent;
    facts: TelegramFlowContextFactsByIntent[TSourceIntent] | null;
    prefill: Partial<TelegramFlowContextFactsByIntent[TSourceIntent]>;
    confidence: number;
  };
}[TIntent];

export type TelegramIncidentJoinPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  getIncidentConfig(incidentId: string): Promise<IncidentConfigResponse>;
  joinIncident(incidentId: string, request: IncidentJoinRequest): Promise<IncidentJoinResponse>;
};

export type TelegramWorkCenterReportPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  createWorkCenter(incidentId: string, request: WorkCenterConnectedCreateRequest): Promise<WorkCenterCreateResponse>;
  getChannelFreshness?(incidentId: string): Promise<SyncFreshness>;
};

export type TelegramResourceNeedRecommendationInput = {
  externalUserId: string;
  displayName?: string;
  preferredLocale: SupportedLocale;
  messageText: string;
  category?: string;
  intent: 'where_needed';
  reportKind: Extract<ResourceReportKind, 'surplus'>;
};

export type TelegramResourceNeedRecommendation = {
  incident: IncidentSummary;
  workCenterId?: string;
  workCenterName?: string;
  category?: string;
  quantityApprox?: string;
  urgency?: ResourceReportUrgency;
  score?: number;
  reasons?: string[];
};

export type TelegramResourceNeedRecommendationResponse = {
  recommendations: TelegramResourceNeedRecommendation[];
};

export type TelegramResourceReportPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  createResourceReport(incidentId: string, request: ResourceReportConnectedCreateRequest): Promise<ResourceReportCreateResponse>;
  listResourceNeedRecommendations?(input: TelegramResourceNeedRecommendationInput): Promise<TelegramResourceNeedRecommendationResponse>;
};

export type TelegramDispatchTaskPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  listDispatchTasks(incidentId: string): Promise<DispatchTaskListResponse>;
  updateDispatchTask(incidentId: string, dispatchTaskId: string, request: DispatchTaskConnectedUpdateRequest): Promise<DispatchTaskResponse>;
};

export type TelegramSosPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  createSosAlert(incidentId: string, request: SosConnectedCreateRequest): Promise<SosAlertCreateResponse>;
};

export type TelegramFamilyReunificationPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  createPrivateLink(incidentId: string, request: PrivateWebLinkIssueRequest): Promise<PrivateWebLinkIssueResponse>;
  formatPrivateLinkUrl?(response: PrivateWebLinkIssueResponse): string;
};

export type TelegramIncidentJoinState =
  | { step: 'idle'; preferredLocale?: SupportedLocale }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingPseudonym'; incident: IncidentSummary; externalUserId: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingRole'; config: IncidentConfigResponse; externalUserId: string; pseudonym: string; preferredLocale?: SupportedLocale }
  | { step: 'joined'; response: IncidentJoinResponse }
  | { step: 'cancelled' };

export type TelegramResourceReportState =
  | { step: 'idle'; preferredLocale?: SupportedLocale }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingRecommendedNeedSelection'; recommendations: TelegramResourceNeedRecommendation[]; externalUserId: string; displayName?: string; preferredLocale: SupportedLocale; category?: string }
  | { step: 'awaitingKind'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingCategory'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; reportKind: ResourceReportKind; recommendedWorkCenterId?: string }
  | { step: 'awaitingQuantity'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; reportKind: ResourceReportKind; category: string; recommendedWorkCenterId?: string }
  | { step: 'awaitingUrgency'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; reportKind: ResourceReportKind; category: string; quantityApprox: string; recommendedWorkCenterId?: string }
  | { step: 'awaitingConstraints'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; reportKind: ResourceReportKind; category: string; quantityApprox: string; urgency: ResourceReportUrgency; recommendedWorkCenterId?: string }
  | { step: 'awaitingWorkCenter'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; request: ResourceReportConnectedCreateRequest }
  | { step: 'awaitingConfirmation'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; request: ResourceReportConnectedCreateRequest }
  | { step: 'reported'; response: ResourceReportCreateResponse }
  | { step: 'cancelled' };

export type TelegramDispatchTaskState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string }
  | { step: 'awaitingTask'; incident: IncidentSummary; tasks: DispatchTask[]; externalUserId: string }
  | { step: 'awaitingStatus'; incident: IncidentSummary; task: DispatchTask; externalUserId: string }
  | { step: 'awaitingConfirmation'; incident: IncidentSummary; task: DispatchTask; externalUserId: string; request: DispatchTaskConnectedUpdateRequest }
  | { step: 'updated'; response: DispatchTaskResponse }
  | { step: 'cancelled' };

export type TelegramSosState =
  | { step: 'idle'; preferredLocale?: SupportedLocale }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingConfirmation'; incident: IncidentSummary; externalUserId: string; displayName?: string; request: SosConnectedCreateRequest; preferredLocale?: SupportedLocale }
  | { step: 'submitted'; response: SosAlertCreateResponse }
  | { step: 'cancelled' };

export type TelegramFamilyReunificationState =
  | { step: 'idle'; preferredLocale?: SupportedLocale }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale }
  | { step: 'linked'; response: PrivateWebLinkIssueResponse }
  | { step: 'cancelled' };

export type TelegramWorkCenterPrefill = Partial<Pick<WorkCenterCreatePayload, 'name' | 'description' | 'priority' | 'initialNeed' | 'surplus' | 'location'>>;

export type TelegramWorkCenterReportState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string; prefill?: TelegramWorkCenterPrefill }
  | { step: 'awaitingName'; incident: IncidentSummary; externalUserId: string; displayName?: string; prefill?: TelegramWorkCenterPrefill }
  | {
      step: 'awaitingConfirmation';
      incident: IncidentSummary;
      externalUserId: string;
      displayName?: string;
      request: WorkCenterConnectedCreateRequest;
    }
  | { step: 'reported'; response: WorkCenterCreateResponse }
  | { step: 'cancelled' };

export type TelegramIncidentJoinFlowResult = {
  state: TelegramIncidentJoinState;
  responseText: string;
};

export type TelegramWorkCenterReportFlowResult = {
  state: TelegramWorkCenterReportState;
  responseText: string;
};

export type TelegramResourceReportFlowResult = {
  state: TelegramResourceReportState;
  responseText: string;
};

export type TelegramDispatchTaskFlowResult = {
  state: TelegramDispatchTaskState;
  responseText: string;
};

export type TelegramSosFlowResult = {
  state: TelegramSosState;
  responseText: string;
};

export type TelegramFamilyReunificationFlowResult = {
  state: TelegramFamilyReunificationState;
  responseText: string;
};

