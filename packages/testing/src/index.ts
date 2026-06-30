import type {
  OperationInput,
  PendingSignedOperation,
  SignedOperation,
  IncidentConfigResponse,
  IncidentJoinRequest,
  IncidentJoinResponse,
  IncidentListResponse,
  SyncPushRequest,
  WebLinkRequest,
  WebLinkSession,
  WorkCenterConnectedCreateRequest,
  WorkCenterCreatePayload,
  WorkCenterCreateResponse,
  WorkCenterDetailResponse,
  WorkCenterListResponse,
} from '@zona-cero/contracts';

export function createSignedOperationFixture(overrides: Partial<SignedOperation> = {}): SignedOperation {
  return {
    opId: 'op-fixture-1',
    version: 1,
    actorKeyId: 'actor-key-fixture',
    deviceId: 'device-fixture',
    incidentId: 'incident-fixture',
    cellId: 'cell-fixture',
    entityId: 'incident-fixture',
    opType: 'incident.create',
    payload: { title: 'Fixture incident' },
    hlc: '2026-06-29T00:00:00.000Z-fixture',
    createdAtDevice: '2026-06-29T00:00:00.000Z',
    entityType: 'incident',
    signature: 'fixture-signature',
    syncState: 'pending',
    ...overrides,
  };
}

export const validSignedOperationFixture = createSignedOperationFixture();

export const validPendingSignedOperationFixture: PendingSignedOperation = {
  ...validSignedOperationFixture,
  syncState: 'pending',
};

export const invalidSignedOperationFixture = {
  ...createSignedOperationFixture({ opId: 'op-invalid-signature' }),
  signature: '',
} as const;

export const validSyncPushRequestFixture: SyncPushRequest = {
  operations: [validPendingSignedOperationFixture],
  cursor: 'cursor-fixture-1',
};

export const validWorkCenterCreatePayloadFixture: WorkCenterCreatePayload = {
  name: 'North triage point',
  centerType: 'Medical post',
  description: 'Triage and water distribution near the north gate.',
  priority: 'high',
  initialNeed: 'Water',
  surplus: 'none reported',
  location: { latitude: 41.38, longitude: 2.17 },
  reportedAt: '2026-06-30T10:00:00.000Z',
};

export const invalidWorkCenterCreatePayloadFixture = {
  ...validWorkCenterCreatePayloadFixture,
  name: '',
  priority: 'urgent',
  location: { latitude: 120, longitude: 2.17 },
} as const;

export const validWorkCenterCreateOperationFixture: PendingSignedOperation = {
  ...createSignedOperationFixture({
    opId: 'op-work-center-create-1',
    incidentId: 'incident-zc-demo',
    cellId: 'cell-zc-demo',
    entityId: 'center-north-triage',
    entityType: 'work_center',
    opType: 'work_center.create',
    payload: validWorkCenterCreatePayloadFixture,
  }),
  syncState: 'pending',
};

export const invalidSyncPushRequestFixture = {
  operations: [createSignedOperationFixture({ opId: 'op-invalid-sync-state', syncState: 'sent' })],
  cursor: 'cursor-fixture-1',
} as const;

export const incompatibleVersionSyncPushRequestFixture = {
  operations: [{ ...validWorkCenterCreateOperationFixture, version: 2 }],
} as const;

export const validWebLinkRequestFixture: WebLinkRequest = {
  scope: 'work_center.detail',
  incidentId: 'incident-fixture',
  entityId: 'center-fixture',
  channelIdentityId: 'telegram-user-fixture',
  correlationId: 'corr-fixture-1',
  returnState: 'telegram:conversation:work-center',
  ttlSeconds: 600,
  singleUse: true,
  auditContext: {
    channel: 'telegram',
    command: '/centro',
    messageId: 42,
  },
};

export const invalidWebLinkRequestFixture = {
  ...validWebLinkRequestFixture,
  scope: 'admin.raw',
  ttlSeconds: 0,
  correlationId: '',
} as const;

export const validWebLinkSessionFixture: WebLinkSession = {
  token: 'opaque-web-link-token-fixture',
  scope: validWebLinkRequestFixture.scope,
  incidentId: validWebLinkRequestFixture.incidentId,
  entityId: validWebLinkRequestFixture.entityId,
  channelIdentityId: validWebLinkRequestFixture.channelIdentityId,
  correlationId: validWebLinkRequestFixture.correlationId,
  returnState: validWebLinkRequestFixture.returnState,
  expiresAt: '2026-06-30T12:00:00.000Z',
  singleUse: validWebLinkRequestFixture.singleUse,
  auditContext: validWebLinkRequestFixture.auditContext,
};

export const invalidWebLinkSessionFixture = {
  ...validWebLinkSessionFixture,
  token: '',
  expiresAt: '',
} as const;


export const webLinkFlowFixtures = {
  'incident.join': {
    happy: {
      ...validWebLinkRequestFixture,
      scope: 'incident.join',
      entityId: undefined,
      correlationId: 'corr-incident-join-1',
      returnState: 'telegram:conversation:incident-join',
      auditContext: {
        channel: 'telegram',
        command: '/start',
        messageId: 1001,
      },
    },
    error: {
      ...validWebLinkRequestFixture,
      scope: 'incident.join',
      ttlSeconds: 0,
      correlationId: '',
      auditContext: {
        channel: 'telegram',
        command: '/start',
        messageId: 1001,
      },
    },
  },
  'work_center.detail': {
    happy: {
      ...validWebLinkRequestFixture,
      scope: 'work_center.detail',
      entityId: 'center-fixture',
      correlationId: 'corr-work-center-detail-1',
      returnState: 'telegram:conversation:work-center-detail',
      auditContext: {
        channel: 'telegram',
        command: '/centro',
        messageId: 1002,
      },
    },
    error: {
      ...validWebLinkRequestFixture,
      scope: 'work_center.detail',
      entityId: '',
      correlationId: 'corr-work-center-detail-1',
      auditContext: {
        channel: 'telegram',
        command: '/centro',
        messageId: 1002,
      },
    },
  },
  'family_reunification.search': {
    happy: {
      ...validWebLinkRequestFixture,
      scope: 'family_reunification.search',
      entityId: undefined,
      correlationId: 'corr-family-reunification-search-1',
      returnState: 'web:family-reunification:search',
      auditContext: {
        channel: 'web-ui',
        command: 'family_reunification.search',
        messageId: 'web-session-fixture',
      },
    },
    error: {
      ...validWebLinkRequestFixture,
      scope: 'family_reunification.search',
      ttlSeconds: -1,
      correlationId: 'corr-family-reunification-search-1',
      auditContext: {
        channel: 'web-ui',
        command: 'family_reunification.search',
        messageId: 'web-session-fixture',
      },
    },
  },
} as const;

export const signedOperationGoldenVector: {
  signer: 'FakeOperationSigner';
  signerKeyMaterial: string;
  input: OperationInput;
  canonicalPayload: string;
  signature: string;
  opId: string;
} = {
  signer: 'FakeOperationSigner',
  signerKeyMaterial: 'fake-key-material',
  input: {
    actorKeyId: 'actor-key-1',
    deviceId: 'device-1',
    incidentId: 'incident-1',
    cellId: 'cell-a',
    entityId: 'center-1',
    opType: 'work_center.create',
    payload: { type: 'medical', description: 'Triage tent', priority: 'high' },
    hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
    createdAtDevice: '2026-06-29T09:00:00.000Z',
  },
  canonicalPayload:
    '{"actorKeyId":"actor-key-1","cellId":"cell-a","createdAtDevice":"2026-06-29T09:00:00.000Z","deviceId":"device-1","entityId":"center-1","hlc":"2026-06-29T09:00:00.000Z-0001-device-1","incidentId":"incident-1","opType":"work_center.create","payload":{"description":"Triage tent","priority":"high","type":"medical"},"version":1}',
  signature: 'fake-signature:actor-key-1:40005f990d0be4c0b64309acaa60a46f14d37751bdb29f6d5cd6dd5bf8b5ee95',
  opId: 'op_14bf734beeb9b7eb7753829bf6c5d8b256d90e4de8f622030f8152fdb41a6d73',
};

export const telegramStartUpdateFixture = {
  update_id: 1,
  message: {
    message_id: 1,
    text: '/start',
    chat: { id: 1001, type: 'private' },
    from: { id: 1001, is_bot: false, first_name: 'Field' },
  },
} as const;


export const incidentListHappyFixture: IncidentListResponse = {
  incidents: [
    {
      incidentId: 'incident-zc-demo',
      name: 'Zona Cero Demo Incident',
      status: 'active',
      startsAt: '2026-06-30T09:00:00.000Z',
      locationName: 'Operations Base',
    },
  ],
};

export const incidentListErrorFixture = {
  incidents: [
    {
      incidentId: '',
      name: '',
      status: 'draft',
      startsAt: '',
      locationName: '',
    },
  ],
} as const;

export const incidentConfigHappyFixture: IncidentConfigResponse = {
  incident: incidentListHappyFixture.incidents[0],
  roles: ['volunteer', 'coordinator', 'logistics', 'medical'],
  channels: ['telegram', 'mobile', 'web-ui'],
  permissionSnapshots: {
    volunteer: {
      canReadIncident: true,
      canJoinIncident: true,
      canManageIncident: false,
      canManageLogistics: false,
      canManageMedical: false,
    },
    coordinator: {
      canReadIncident: true,
      canJoinIncident: true,
      canManageIncident: true,
      canManageLogistics: true,
      canManageMedical: true,
    },
    logistics: {
      canReadIncident: true,
      canJoinIncident: true,
      canManageIncident: false,
      canManageLogistics: true,
      canManageMedical: false,
    },
    medical: {
      canReadIncident: true,
      canJoinIncident: true,
      canManageIncident: false,
      canManageLogistics: false,
      canManageMedical: true,
    },
  },
};

export const incidentConfigErrorFixture = {
  incident: { incidentId: '', name: '', status: 'draft', startsAt: '', locationName: '' },
  roles: ['admin'],
  channels: ['sms'],
  permissionSnapshots: {},
} as const;

export const telegramIncidentJoinRequestFixture: IncidentJoinRequest = {
  channel: 'telegram',
  externalId: 'telegram-user-1001',
  displayName: 'Field Telegram',
  role: 'volunteer',
};

export const mobileIncidentJoinRequestFixture: IncidentJoinRequest = {
  channel: 'mobile',
  externalId: 'mobile-device-1001',
  displayName: 'Field Mobile',
  role: 'medical',
};

export const invalidIncidentJoinRequestFixture = {
  channel: 'telegram',
  externalId: 'telegram-user-1001',
  role: 'admin',
} as const;

export const telegramIncidentJoinResponseFixture: IncidentJoinResponse = {
  incident: incidentListHappyFixture.incidents[0],
  channelIdentity: {
    channelIdentityId: 'chid_telegram_telegram-user-1001',
    channel: 'telegram',
    externalId: 'telegram-user-1001',
    displayName: 'Field Telegram',
  },
  membership: {
    incidentMembershipId: 'mship_incident-zc-demo_chid_telegram_telegram-user-1001_volunteer',
    incidentId: 'incident-zc-demo',
    channelIdentityId: 'chid_telegram_telegram-user-1001',
    role: 'volunteer',
    permissions: incidentConfigHappyFixture.permissionSnapshots.volunteer,
  },
  audit: { auditEventId: 'audit_join_incident-zc-demo_chid_telegram_telegram-user-1001_volunteer' },
  idempotent: false,
};

export const mobileIncidentJoinResponseFixture: IncidentJoinResponse = {
  incident: incidentListHappyFixture.incidents[0],
  channelIdentity: {
    channelIdentityId: 'chid_mobile_mobile-device-1001',
    channel: 'mobile',
    externalId: 'mobile-device-1001',
    displayName: 'Field Mobile',
  },
  membership: {
    incidentMembershipId: 'mship_incident-zc-demo_chid_mobile_mobile-device-1001_medical',
    incidentId: 'incident-zc-demo',
    channelIdentityId: 'chid_mobile_mobile-device-1001',
    role: 'medical',
    permissions: incidentConfigHappyFixture.permissionSnapshots.medical,
  },
  audit: { auditEventId: 'audit_join_incident-zc-demo_chid_mobile_mobile-device-1001_medical' },
  idempotent: false,
};

export const incidentJoinFixtures = {
  telegram: {
    happy: { request: telegramIncidentJoinRequestFixture, response: telegramIncidentJoinResponseFixture },
    error: invalidIncidentJoinRequestFixture,
  },
  mobile: {
    happy: { request: mobileIncidentJoinRequestFixture, response: mobileIncidentJoinResponseFixture },
    error: { ...mobileIncidentJoinRequestFixture, externalId: '', role: 'medical' },
  },
} as const;

export const telegramWorkCenterCreateRequestFixture: WorkCenterConnectedCreateRequest = {
  channel: 'telegram',
  externalId: 'telegram-user-1001',
  displayName: 'Field Telegram',
  payload: validWorkCenterCreatePayloadFixture,
};

export const webWorkCenterCreateRequestFixture: WorkCenterConnectedCreateRequest = {
  channel: 'web-ui',
  externalId: 'web-user-1001',
  displayName: 'Field Web',
  payload: {
    ...validWorkCenterCreatePayloadFixture,
    name: 'Web logistics desk',
    centerType: 'Logistics desk',
    priority: 'medium',
  },
};

export const mobileWorkCenterCreateSyncPushFixture: SyncPushRequest = {
  operations: [validWorkCenterCreateOperationFixture],
  cursor: 'cursor-work-center-mobile-1',
};

export const workCenterListHappyFixture: WorkCenterListResponse = {
  workCenters: [
    {
      workCenterId: 'center-north-triage',
      incidentId: 'incident-zc-demo',
      cellId: 'cell-zc-demo',
      name: 'North triage point',
      centerType: 'Medical post',
      priority: 'high',
      location: { latitude: 41.38, longitude: 2.17 },
      status: 'reported',
      activationState: 'pending_corroboration',
      freshness: 'fresh',
      confidence: 'low',
      risk: 'medium',
      signalCount: 1,
      corroboratingSignalCount: 1,
      sourceChannel: 'telegram',
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    },
  ],
};

export const workCenterDetailHappyFixture: WorkCenterDetailResponse = {
  workCenter: {
    ...workCenterListHappyFixture.workCenters[0],
    description: validWorkCenterCreatePayloadFixture.description,
    initialNeed: validWorkCenterCreatePayloadFixture.initialNeed,
    surplus: validWorkCenterCreatePayloadFixture.surplus,
    latestSignals: [
      {
        signalId: 'sig-center-north-triage-creator',
        signalType: 'creator_report',
        sourceChannel: 'telegram',
        sourceId: 'telegram-user-1001',
        createdAt: '2026-06-30T10:00:00.000Z',
      },
    ],
  },
};

export const workCenterCreateResponseHappyFixture: WorkCenterCreateResponse = {
  workCenter: workCenterDetailHappyFixture.workCenter,
  audit: { auditEventId: 'audit_work_center_created_incident-zc-demo_center-north-triage' },
  idempotent: false,
};

export const workCenterApiFixtures = {
  telegram: {
    happy: { request: telegramWorkCenterCreateRequestFixture, response: workCenterCreateResponseHappyFixture },
    error: { ...telegramWorkCenterCreateRequestFixture, payload: invalidWorkCenterCreatePayloadFixture },
  },
  web: {
    happy: { request: webWorkCenterCreateRequestFixture },
    error: { ...webWorkCenterCreateRequestFixture, externalId: '' },
  },
  mobile: {
    happy: { request: mobileWorkCenterCreateSyncPushFixture },
    error: incompatibleVersionSyncPushRequestFixture,
  },
} as const;
