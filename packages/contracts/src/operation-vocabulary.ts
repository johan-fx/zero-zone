export const operationTypes = [
  'incident.create',
  'work_center.create',
  'presence.check_in',
  'presence.pause',
  'presence.check_out',
  'resource_report.create',
  'dispatch_event.create',
  'dispatch_event.update',
  'sos.create',
  'sos.cancel',
] as const;

export type OperationType = (typeof operationTypes)[number];

export const operationFamilies = ['incident', 'work_center', 'presence', 'resource_report', 'dispatch_event', 'sos'] as const;

export type OperationFamily = (typeof operationFamilies)[number];

export const syncStates = ['pending', 'sent', 'confirmed', 'conflict', 'rejected'] as const;

export type SyncState = (typeof syncStates)[number];

export const operationTypeFamilies = {
  'incident.create': 'incident',
  'work_center.create': 'work_center',
  'presence.check_in': 'presence',
  'presence.pause': 'presence',
  'presence.check_out': 'presence',
  'resource_report.create': 'resource_report',
  'dispatch_event.create': 'dispatch_event',
  'dispatch_event.update': 'dispatch_event',
  'sos.create': 'sos',
  'sos.cancel': 'sos',
} as const satisfies Record<OperationType, OperationFamily>;
