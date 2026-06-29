import { z } from 'zod';

export const operationTypes = [
  'incident.create',
  'work_center.create',
  'presence.check_in',
  'presence.heartbeat',
  'presence.check_out',
  'resource.report_need',
  'resource.report_surplus',
  'dispatch.create',
  'dispatch.accept',
  'sos.raise',
  'sos.ack',
] as const;

export const OperationTypeSchema = z.enum(operationTypes);
export type OperationType = z.infer<typeof OperationTypeSchema>;

export const SignedOperationSchema = z.object({
  opId: z.string().min(1),
  opVersion: z.literal(1),
  actorKeyId: z.string().min(1),
  deviceId: z.string().min(1),
  incidentId: z.string().min(1),
  cellId: z.string().min(1),
  entityId: z.string().min(1),
  opType: OperationTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  hlc: z.string().min(1),
  createdAtDevice: z.string().min(1),
  previousOpIds: z.array(z.string()).optional(),
  signature: z.string().min(1),
});
export type SignedOperation = z.infer<typeof SignedOperationSchema>;

export const OperationAcceptedSchema = z.object({
  opId: z.string(),
  status: z.enum(['accepted', 'duplicate', 'rejected_signature', 'rejected_policy', 'conflict_needs_review']),
});
export type OperationAccepted = z.infer<typeof OperationAcceptedSchema>;

export const SyncPushRequestSchema = z.object({
  operations: z.array(SignedOperationSchema),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncPushResponseSchema = z.object({
  results: z.array(OperationAcceptedSchema),
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

export const contractErrorCodes = [
  'invalid_payload',
  'invalid_signature',
  'unauthorized_operation',
  'stale_cursor',
] as const;
export type ContractErrorCode = (typeof contractErrorCodes)[number];
