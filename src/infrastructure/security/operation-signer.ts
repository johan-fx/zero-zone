export type SyncState = 'pending' | 'sent' | 'confirmed' | 'conflict' | 'rejected';

export type OperationFamily = 'incident' | 'work_center' | 'presence' | 'resource_report' | 'dispatch_event' | 'sos';

export type OperationType =
  | 'incident.create'
  | 'work_center.create'
  | 'presence.check_in'
  | 'presence.pause'
  | 'presence.check_out'
  | 'resource_report.create'
  | 'dispatch_event.create'
  | 'dispatch_event.update'
  | 'sos.create'
  | 'sos.cancel';

export type OperationSigner = {
  sign(input: { canonicalPayload: string; actorKeyId: string }): Promise<string>;
};

export type OperationInput = {
  version?: 1;
  actorKeyId: string;
  deviceId: string;
  incidentId: string;
  cellId: string;
  entityId: string;
  opType: OperationType;
  payload: unknown;
  hlc: string;
  createdAtDevice: string;
};

export type SignedOperation = Required<OperationInput> & {
  opId: string;
  entityType: OperationFamily;
  signature: string;
  syncState: SyncState;
};

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

export class SigningUnavailableError extends Error {
  constructor(message = 'Signing material is unavailable') {
    super(message);
    this.name = 'SigningUnavailableError';
  }
}

export type ActorKeyProvider = {
  getActorKeyId(): Promise<string>;
};

export function createCanonicalPayload(input: OperationInput): string {
  return stableStringify({ ...input, version: input.version ?? 1 });
}

export async function createSignedOperation(input: OperationInput, signer: OperationSigner): Promise<SignedOperation> {
  const canonicalPayload = createCanonicalPayload(input);
  const signature = await signer.sign({ canonicalPayload, actorKeyId: input.actorKeyId });

  return {
    ...input,
    version: 1,
    opId: `op_${stableHash(`${canonicalPayload}:${signature}`)}`,
    entityType: operationTypeFamilies[input.opType],
    signature,
    syncState: 'pending',
  };
}

export class FakeOperationSigner implements OperationSigner {
  constructor(private readonly keyMaterial: string) {}

  async sign({ canonicalPayload, actorKeyId }: { canonicalPayload: string; actorKeyId: string }): Promise<string> {
    if (!this.keyMaterial) {
      throw new SigningUnavailableError();
    }

    return `fake-signature:${actorKeyId}:${stableHash(`${this.keyMaterial}:${canonicalPayload}`)}`;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const record = value as Record<string, unknown>;

  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
