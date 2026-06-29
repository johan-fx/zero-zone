import type { OperationType } from '@zona-cero/contracts';

export type Channel = 'mobile' | 'web-ui' | 'telegram';
export type RoleTrustLevel = 'self_declared' | 'field_attested' | 'trusted_by_context' | 'org_verified';

const criticalOperationPrefixes = ['sos.', 'incident.verify'] as const;

export function isCriticalOperation(opType: OperationType): boolean {
  return criticalOperationPrefixes.some((prefix) => opType.startsWith(prefix));
}

export function canChannelSubmitOperation(channel: Channel, opType: OperationType): boolean {
  if (channel === 'web-ui') {
    return !opType.startsWith('presence.');
  }

  return true;
}

export function canAccessRestrictedIncidentData(roleTrustLevel: RoleTrustLevel): boolean {
  return roleTrustLevel === 'org_verified';
}
