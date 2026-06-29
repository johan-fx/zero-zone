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
    opId: `op_${stableDigest(`${canonicalPayload}:${signature}`)}`,
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

    return `fake-signature:${actorKeyId}:${stableDigest(`${this.keyMaterial}:${canonicalPayload}`)}`;
  }
}

function stableStringify(value: unknown, seen = new WeakSet<object>()): string {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new TypeError('Operation payload must be JSON-serializable');
  }

  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('Operation payload must be JSON-serializable');
    }

    return JSON.stringify(value);
  }

  if (seen.has(value)) {
    throw new TypeError('Operation payload must be JSON-serializable');
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
    throw new TypeError('Operation payload must be JSON-serializable');
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const serialized = `[${value.map((item) => stableStringify(item, seen)).join(',')}]`;

    seen.delete(value);

    return serialized;
  }

  const record = value as Record<string, unknown>;

  const serialized = `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key], seen)}`)
    .join(',')}}`;

  seen.delete(value);

  return serialized;
}

function stableDigest(value: string): string {
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  const padded = [...bytes, 0x80];

  while (padded.length % 64 !== 56) {
    padded.push(0);
  }

  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;

  padded.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff, (low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff);

  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    const words = new Array<number>(64);

    for (let index = 0; index < 16; index += 1) {
      const offset = chunk + index * 4;
      words[index] = ((padded[offset] << 24) | (padded[offset + 1] << 16) | (padded[offset + 2] << 8) | padded[offset + 3]) >>> 0;
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7) ^ rotateRight(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rotateRight(words[index - 2], 17) ^ rotateRight(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + sha256Constants[index] + words[index]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index)!;

    if (codePoint > 0xffff) {
      index += 1;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >>> 12), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >>> 18), 0x80 | ((codePoint >>> 12) & 0x3f), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    }
  }

  return bytes;
}

const sha256Constants = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
