import { z } from 'zod';

export { operationFamilies, operationTypeFamilies, operationTypes, syncStates } from './operation-vocabulary';
import { operationFamilies, operationTypeFamilies, operationTypes, syncStates } from './operation-vocabulary';

export const OperationTypeSchema = z.enum(operationTypes);
export type OperationType = z.infer<typeof OperationTypeSchema>;

export const OperationFamilySchema = z.enum(operationFamilies);
export type OperationFamily = z.infer<typeof OperationFamilySchema>;

export const SyncStateSchema = z.enum(syncStates);
export type SyncState = z.infer<typeof SyncStateSchema>;

export const contractErrorCodes = [
  'invalid_payload',
  'invalid_operation_version',
  'invalid_signature',
  'unauthorized_operation',
  'permission_denied',
  'stale_cursor',
  'duplicate_operation',
  'operation_conflict',
  'not_found',
  'unsupported_operation_type',
  'link_expired',
  'invalid_link_scope',
  'link_correlation_mismatch',
] as const;

export const ContractErrorCodeSchema = z.enum(contractErrorCodes);
export type ContractErrorCode = z.infer<typeof ContractErrorCodeSchema>;

export const contractErrorSemantics = {
  invalid_payload: {
    meaning: 'The request body or operation payload is malformed, incomplete, or not JSON-compatible.',
    visibleMappingKey: {
      telegram: 'telegram.error.invalid_payload',
      web: 'web.error.invalid_payload',
    },
  },
  invalid_operation_version: {
    meaning: 'The signed operation version is not supported by this API; version 1 remains accepted.',
    visibleMappingKey: {
      telegram: 'telegram.error.invalid_operation_version',
      web: 'web.error.invalid_operation_version',
    },
  },
  invalid_signature: {
    meaning: 'The signed operation cannot be verified with the expected actor key and canonical payload.',
    visibleMappingKey: {
      telegram: 'telegram.error.invalid_signature',
      web: 'web.error.invalid_signature',
    },
  },
  unauthorized_operation: {
    meaning: 'The actor, channel identity, role, or device is not allowed to perform the requested operation.',
    visibleMappingKey: {
      telegram: 'telegram.error.unauthorized_operation',
      web: 'web.error.unauthorized_operation',
    },
  },
  permission_denied: {
    meaning: 'The caller is known but lacks permission to perform the requested operation in this incident.',
    visibleMappingKey: {
      telegram: 'telegram.error.permission_denied',
      web: 'web.error.permission_denied',
    },
  },
  stale_cursor: {
    meaning: 'The sync cursor is too old or no longer compatible with the current sync window.',
    visibleMappingKey: {
      telegram: 'telegram.error.stale_cursor',
      web: 'web.error.stale_cursor',
    },
  },
  duplicate_operation: {
    meaning: 'The operation was already accepted or processed for the same opId/idempotency boundary.',
    visibleMappingKey: {
      telegram: 'telegram.error.duplicate_operation',
      web: 'web.error.duplicate_operation',
    },
  },
  operation_conflict: {
    meaning: 'The idempotency key or entity already exists with incompatible payload or ownership.',
    visibleMappingKey: {
      telegram: 'telegram.error.operation_conflict',
      web: 'web.error.operation_conflict',
    },
  },
  not_found: {
    meaning: 'The requested incident, entity, or sync target does not exist.',
    visibleMappingKey: {
      telegram: 'telegram.error.not_found',
      web: 'web.error.not_found',
    },
  },
  unsupported_operation_type: {
    meaning: 'The operation type is not part of the stable shared operation vocabulary.',
    visibleMappingKey: {
      telegram: 'telegram.error.unsupported_operation_type',
      web: 'web.error.unsupported_operation_type',
    },
  },
  link_expired: {
    meaning: 'The web link session is expired, already consumed, or outside its valid TTL window.',
    visibleMappingKey: {
      telegram: 'telegram.error.link_expired',
      web: 'web.error.link_expired',
    },
  },
  invalid_link_scope: {
    meaning: 'The web link scope is unknown or not allowed for the requested flow/entity.',
    visibleMappingKey: {
      telegram: 'telegram.error.invalid_link_scope',
      web: 'web.error.invalid_link_scope',
    },
  },
  link_correlation_mismatch: {
    meaning: 'The web link callback/session correlation does not match the originating channel flow.',
    visibleMappingKey: {
      telegram: 'telegram.error.link_correlation_mismatch',
      web: 'web.error.link_correlation_mismatch',
    },
  },
} as const satisfies Record<
  (typeof contractErrorCodes)[number],
  {
    meaning: string;
    visibleMappingKey: {
      telegram: string;
      web: string;
    };
  }
>;

const JsonObjectPayloadSchema = z.record(z.string(), z.unknown()).superRefine((value, context) => {
  const invalidPath = findNonJsonPath(value);

  if (invalidPath) {
    context.addIssue({
      code: 'custom',
      message: 'Payload must be a JSON-compatible object',
      path: invalidPath,
    });
  }
});

export const OperationInputSchema = z.object({
  version: z.literal(1).optional(),
  actorKeyId: z.string().min(1),
  deviceId: z.string().min(1),
  incidentId: z.string().min(1),
  cellId: z.string().min(1),
  entityId: z.string().min(1),
  opType: OperationTypeSchema,
  payload: JsonObjectPayloadSchema,
  hlc: z.string().min(1),
  createdAtDevice: z.string().min(1),
});
export type OperationInput = z.infer<typeof OperationInputSchema>;

const BaseSignedOperationSchema = OperationInputSchema.extend({
  version: z.literal(1),
  payload: JsonObjectPayloadSchema,
  opId: z.string().min(1),
  entityType: OperationFamilySchema,
  signature: z.string().min(1),
  syncState: SyncStateSchema,
});

function validateOperationFamily(operation: z.infer<typeof BaseSignedOperationSchema>, context: z.RefinementCtx): void {
  if (operationTypeFamilies[operation.opType] !== operation.entityType) {
    context.addIssue({
      code: 'custom',
      message: 'entityType must match opType family',
      path: ['entityType'],
    });
  }
}

export const SignedOperationSchema = BaseSignedOperationSchema.superRefine(validateOperationFamily);
export type SignedOperation = z.infer<typeof SignedOperationSchema>;

export const PendingSignedOperationSchema = BaseSignedOperationSchema.extend({
  syncState: z.literal('pending'),
}).superRefine(validateOperationFamily);
export type PendingSignedOperation = z.infer<typeof PendingSignedOperationSchema>;

export const OperationAcceptedSchema = z.object({
  opId: z.string().min(1),
  status: z.literal('accepted'),
});
export type OperationAccepted = z.infer<typeof OperationAcceptedSchema>;

export const OperationRejectedSchema = z.object({
  opId: z.string().min(1).optional(),
  status: z.literal('rejected'),
  code: ContractErrorCodeSchema,
  message: z.string().optional(),
});
export type OperationRejected = z.infer<typeof OperationRejectedSchema>;

export const SyncPushResultSchema = z.discriminatedUnion('status', [OperationAcceptedSchema, OperationRejectedSchema]);
export type SyncPushResult = z.infer<typeof SyncPushResultSchema>;

export const SyncPushRequestSchema = z.object({
  operations: z.array(PendingSignedOperationSchema),
  cursor: z.string().nullable().optional(),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncPushResponseSchema = z.object({
  results: z.array(SyncPushResultSchema),
  cursor: z.string().nullable().optional(),
});
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;

export const channels = ['telegram', 'mobile', 'web-ui'] as const;
export const ChannelSchema = z.enum(channels);
export type Channel = z.infer<typeof ChannelSchema>;

export const incidentRoles = ['volunteer', 'coordinator', 'logistics', 'medical'] as const;
export const IncidentRoleSchema = z.enum(incidentRoles);
export type IncidentRole = z.infer<typeof IncidentRoleSchema>;

export const PermissionSnapshotSchema = z.object({
  canReadIncident: z.boolean(),
  canJoinIncident: z.boolean(),
  canManageIncident: z.boolean(),
  canManageLogistics: z.boolean(),
  canManageMedical: z.boolean(),
});
export type PermissionSnapshot = z.infer<typeof PermissionSnapshotSchema>;

export const ChannelIdentitySchema = z.object({
  channelIdentityId: z.string().min(1),
  channel: ChannelSchema,
  externalId: z.string().min(1),
  displayName: z.string().min(1).optional(),
});
export type ChannelIdentity = z.infer<typeof ChannelIdentitySchema>;

export const IncidentMembershipSchema = z.object({
  incidentMembershipId: z.string().min(1),
  incidentId: z.string().min(1),
  channelIdentityId: z.string().min(1),
  role: IncidentRoleSchema,
  permissions: PermissionSnapshotSchema,
});
export type IncidentMembership = z.infer<typeof IncidentMembershipSchema>;

export const AuditReferenceSchema = z.object({
  auditEventId: z.string().min(1),
});
export type AuditReference = z.infer<typeof AuditReferenceSchema>;

export const workCenterStatuses = ['reported', 'active', 'inactive', 'archived'] as const;
export const WorkCenterStatusSchema = z.enum(workCenterStatuses);
export type WorkCenterStatus = z.infer<typeof WorkCenterStatusSchema>;

export const workCenterActivationStates = ['pending_corroboration', 'active', 'needs_review'] as const;
export const WorkCenterActivationStateSchema = z.enum(workCenterActivationStates);
export type WorkCenterActivationState = z.infer<typeof WorkCenterActivationStateSchema>;

export const workCenterFreshnessLevels = ['fresh', 'stale', 'expired'] as const;
export const WorkCenterFreshnessSchema = z.enum(workCenterFreshnessLevels);
export type WorkCenterFreshness = z.infer<typeof WorkCenterFreshnessSchema>;

export const workCenterConfidenceLevels = ['low', 'medium', 'high'] as const;
export const WorkCenterConfidenceSchema = z.enum(workCenterConfidenceLevels);
export type WorkCenterConfidence = z.infer<typeof WorkCenterConfidenceSchema>;

export const workCenterRiskLevels = ['low', 'medium', 'high'] as const;
export const WorkCenterRiskSchema = z.enum(workCenterRiskLevels);
export type WorkCenterRisk = z.infer<typeof WorkCenterRiskSchema>;

export const workCenterPriorities = ['low', 'medium', 'high', 'critical'] as const;
export const WorkCenterPrioritySchema = z.enum(workCenterPriorities);
export type WorkCenterPriority = z.infer<typeof WorkCenterPrioritySchema>;

export const workCenterSignalTypes = ['creator_report', 'presence_check_in', 'resource_report', 'coordinator_attestation'] as const;
export const WorkCenterSignalTypeSchema = z.enum(workCenterSignalTypes);
export type WorkCenterSignalType = z.infer<typeof WorkCenterSignalTypeSchema>;

export const WorkCenterLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type WorkCenterLocation = z.infer<typeof WorkCenterLocationSchema>;

export const WorkCenterCreatePayloadSchema = z.object({
  name: z.string().min(1),
  centerType: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: WorkCenterPrioritySchema.default('medium'),
  initialNeed: z.string().min(1).optional(),
  surplus: z.string().min(1).optional(),
  location: WorkCenterLocationSchema.optional(),
  reportedAt: z.string().min(1).optional(),
});
export type WorkCenterCreatePayload = z.infer<typeof WorkCenterCreatePayloadSchema>;

const WorkCenterBaseSchema = z.object({
  workCenterId: z.string().min(1),
  incidentId: z.string().min(1),
  cellId: z.string().min(1),
  name: z.string().min(1),
  centerType: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: WorkCenterPrioritySchema,
  initialNeed: z.string().min(1).optional(),
  surplus: z.string().min(1).optional(),
  location: WorkCenterLocationSchema.optional(),
  status: WorkCenterStatusSchema,
  activationState: WorkCenterActivationStateSchema,
  freshness: WorkCenterFreshnessSchema,
  confidence: WorkCenterConfidenceSchema,
  risk: WorkCenterRiskSchema,
  signalCount: z.number().int().nonnegative(),
  corroboratingSignalCount: z.number().int().nonnegative(),
  sourceChannel: ChannelSchema.optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const WorkCenterSummarySchema = WorkCenterBaseSchema.omit({ description: true, initialNeed: true, surplus: true });
export type WorkCenterSummary = z.infer<typeof WorkCenterSummarySchema>;

export const WorkCenterDetailSchema = WorkCenterBaseSchema.extend({
  latestSignals: z.array(
    z.object({
      signalId: z.string().min(1),
      signalType: WorkCenterSignalTypeSchema,
      sourceChannel: ChannelSchema,
      sourceId: z.string().min(1),
      createdAt: z.string().min(1),
    }),
  ),
});
export type WorkCenterDetail = z.infer<typeof WorkCenterDetailSchema>;

export const WorkCenterListResponseSchema = z.object({
  workCenters: z.array(WorkCenterSummarySchema),
});
export type WorkCenterListResponse = z.infer<typeof WorkCenterListResponseSchema>;

export const WorkCenterCreateResponseSchema = z.object({
  workCenter: WorkCenterDetailSchema,
  audit: AuditReferenceSchema,
  idempotent: z.boolean(),
});
export type WorkCenterCreateResponse = z.infer<typeof WorkCenterCreateResponseSchema>;

export const WorkCenterDetailResponseSchema = z.object({
  workCenter: WorkCenterDetailSchema,
});
export type WorkCenterDetailResponse = z.infer<typeof WorkCenterDetailResponseSchema>;

export const WorkCenterConnectedCreateRequestSchema = z.object({
  channel: ChannelSchema,
  externalId: z.string().min(1),
  displayName: z.string().min(1).optional(),
  payload: WorkCenterCreatePayloadSchema,
});
export type WorkCenterConnectedCreateRequest = z.infer<typeof WorkCenterConnectedCreateRequestSchema>;

export const IncidentSummarySchema = z.object({
  incidentId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['active', 'closed']),
  startsAt: z.string().min(1),
  locationName: z.string().min(1),
});
export type IncidentSummary = z.infer<typeof IncidentSummarySchema>;

export const IncidentListResponseSchema = z.object({
  incidents: z.array(IncidentSummarySchema),
});
export type IncidentListResponse = z.infer<typeof IncidentListResponseSchema>;

export const IncidentConfigResponseSchema = z.object({
  incident: IncidentSummarySchema,
  roles: z.array(IncidentRoleSchema),
  channels: z.array(ChannelSchema),
  permissionSnapshots: z.record(IncidentRoleSchema, PermissionSnapshotSchema),
});
export type IncidentConfigResponse = z.infer<typeof IncidentConfigResponseSchema>;

export const IncidentJoinRequestSchema = z.object({
  channel: ChannelSchema,
  externalId: z.string().min(1),
  role: IncidentRoleSchema,
  displayName: z.string().min(1).optional(),
});
export type IncidentJoinRequest = z.infer<typeof IncidentJoinRequestSchema>;

export const IncidentJoinResponseSchema = z.object({
  incident: IncidentSummarySchema,
  channelIdentity: ChannelIdentitySchema,
  membership: IncidentMembershipSchema,
  audit: AuditReferenceSchema,
  idempotent: z.boolean(),
});
export type IncidentJoinResponse = z.infer<typeof IncidentJoinResponseSchema>;

export const HealthResponseSchema = z.object({
  service: z.literal('zona-cero-api'),
  ok: z.literal(true),
  version: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const TelegramWebhookResultSchema = z.object({
  accepted: z.boolean(),
  command: z.string().nullable(),
  responseText: z.string(),
});
export type TelegramWebhookResult = z.infer<typeof TelegramWebhookResultSchema>;

export const webLinkScopes = ['incident.join', 'work_center.detail', 'family_reunification.search'] as const;

export const WebLinkScopeSchema = z.enum(webLinkScopes);
export type WebLinkScope = z.infer<typeof WebLinkScopeSchema>;

export const WebLinkRequestSchema = z.object({
  scope: WebLinkScopeSchema,
  incidentId: z.string().min(1),
  entityId: z.string().min(1).optional(),
  channelIdentityId: z.string().min(1),
  correlationId: z.string().min(1),
  returnState: z.string().min(1).optional(),
  ttlSeconds: z.number().int().positive().max(86_400),
  singleUse: z.boolean(),
  auditContext: JsonObjectPayloadSchema,
});
export type WebLinkRequest = z.infer<typeof WebLinkRequestSchema>;

export const WebLinkSessionSchema = z.object({
  token: z.string().min(1),
  scope: WebLinkScopeSchema,
  incidentId: z.string().min(1),
  entityId: z.string().min(1).optional(),
  channelIdentityId: z.string().min(1),
  correlationId: z.string().min(1),
  returnState: z.string().min(1).optional(),
  expiresAt: z.string().min(1),
  singleUse: z.boolean(),
  auditContext: JsonObjectPayloadSchema,
});
export type WebLinkSession = z.infer<typeof WebLinkSessionSchema>;

function findNonJsonPath(value: unknown, path: (string | number)[] = [], seen = new WeakSet<object>()): (string | number)[] | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? null : path;
  }

  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return path;
  }

  if (typeof value !== 'object') {
    return path;
  }

  if (seen.has(value)) {
    return path;
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
    return path;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const invalidPath = findNonJsonPath(item, [...path, index], seen);

      if (invalidPath) {
        return invalidPath;
      }
    }

    seen.delete(value);
    return null;
  }

  for (const [key, item] of Object.entries(value)) {
    const invalidPath = findNonJsonPath(item, [...path, key], seen);

    if (invalidPath) {
      return invalidPath;
    }
  }

  seen.delete(value);
  return null;
}
