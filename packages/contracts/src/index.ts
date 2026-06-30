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
  'invalid_signature',
  'unauthorized_operation',
  'stale_cursor',
  'duplicate_operation',
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
