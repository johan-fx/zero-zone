import { describe, expect, it } from 'vitest';

import {
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  IncidentJoinResponseSchema,
  IncidentListResponseSchema,
  FamilyReunificationSearchRequestSchema,
  FamilyReunificationSearchResponseSchema,
  PendingSignedOperationSchema,
  PrivateWebLinkConsumeRequestSchema,
  PrivateWebLinkConsumeResponseSchema,
  PrivateWebLinkIssueRequestSchema,
  PrivateWebLinkIssueResponseSchema,
  PrivateWebLinkValidateRequestSchema,
  PrivateWebLinkValidateResponseSchema,
  SignedOperationSchema,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
  SosConnectedCreateRequestSchema,
  SosCreatePayloadSchema,
  SyncPushRequestSchema,
  WebLinkRequestSchema,
  WebLinkSessionSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreatePayloadSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
} from '@zona-cero/contracts';
import {
  createSignedOperationFixture,
  familyReunificationSearchRequestFixture,
  familyReunificationSearchResponseFixture,
  incompatibleVersionSyncPushRequestFixture,
  incidentConfigErrorFixture,
  incidentConfigHappyFixture,
  incidentJoinFixtures,
  incidentListErrorFixture,
  incidentListHappyFixture,
  invalidSignedOperationFixture,
  invalidSosCreatePayloadFixture,
  invalidSyncPushRequestFixture,
  invalidWorkCenterCreatePayloadFixture,
  mobileWorkCenterCreateSyncPushFixture,
  mobileSosCancelSyncPushFixture,
  mobileSosCreateSyncPushFixture,
  privateFamilyReunificationConsumeRequestFixture,
  privateFamilyReunificationConsumeResponseFixture,
  privateFamilyReunificationIssueRequestFixture,
  privateFamilyReunificationIssueResponseFixture,
  privateFamilyReunificationValidateRequestFixture,
  privateFamilyReunificationValidateResponseFixture,
  invalidWebLinkRequestFixture,
  invalidWebLinkSessionFixture,
  signedOperationGoldenVector,
  sosAlertCreateResponseHappyFixture,
  sosAlertStatusHappyFixture,
  sosApiFixtures,
  telegramIncidentJoinRequestFixture,
  telegramSosCreateRequestFixture,
  telegramStartUpdateFixture,
  telegramWorkCenterCreateRequestFixture,
  validSignedOperationFixture,
  validSosCancelOperationFixture,
  validSosCreateOperationFixture,
  validSosCreatePayloadFixture,
  validSyncPushRequestFixture,
  validWorkCenterCreateOperationFixture,
  validWorkCenterCreatePayloadFixture,
  validWebLinkRequestFixture,
  validWebLinkSessionFixture,
  webLinkFlowFixtures,
  webWorkCenterCreateRequestFixture,
  workCenterApiFixtures,
  workCenterCreateResponseHappyFixture,
  workCenterDetailHappyFixture,
  workCenterListHappyFixture,
} from './index';

describe('testing package', () => {
  it('creates contract-valid signed operation fixtures', () => {
    expect(SignedOperationSchema.parse(createSignedOperationFixture({ opId: 'op-custom' })).opId).toBe('op-custom');
    expect(SignedOperationSchema.parse(validSignedOperationFixture).syncState).toBe('pending');
    expect(SignedOperationSchema.safeParse(invalidSignedOperationFixture).success).toBe(false);
  });

  it('exposes shared valid and invalid sync push fixtures', () => {
    expect(SyncPushRequestSchema.parse(validSyncPushRequestFixture).operations).toHaveLength(1);
    expect(PendingSignedOperationSchema.parse(validSyncPushRequestFixture.operations[0]).syncState).toBe('pending');
    expect(SyncPushRequestSchema.safeParse(invalidSyncPushRequestFixture).success).toBe(false);
    expect(SyncPushRequestSchema.safeParse(incompatibleVersionSyncPushRequestFixture).success).toBe(false);
  });

  it('exposes canonical work center payloads and operation fixtures', () => {
    expect(WorkCenterCreatePayloadSchema.parse(validWorkCenterCreatePayloadFixture).name).toBe('North triage point');
    expect(WorkCenterCreatePayloadSchema.safeParse(invalidWorkCenterCreatePayloadFixture).success).toBe(false);
    expect(PendingSignedOperationSchema.parse(validWorkCenterCreateOperationFixture)).toMatchObject({
      opType: 'work_center.create',
      entityType: 'work_center',
    });
    expect(SyncPushRequestSchema.parse(mobileWorkCenterCreateSyncPushFixture).operations[0]?.opType).toBe('work_center.create');
  });

  it('exposes canonical SOS fixtures for connected and mobile critical flows', () => {
    expect(SosCreatePayloadSchema.parse(validSosCreatePayloadFixture).severity).toBe('critical');
    expect(SosCreatePayloadSchema.safeParse(invalidSosCreatePayloadFixture).success).toBe(false);
    expect(PendingSignedOperationSchema.parse(validSosCreateOperationFixture)).toMatchObject({
      opType: 'sos.create',
      entityType: 'sos',
    });
    expect(PendingSignedOperationSchema.parse(validSosCancelOperationFixture)).toMatchObject({
      opType: 'sos.cancel',
      entityType: 'sos',
    });
    expect(SyncPushRequestSchema.parse(mobileSosCreateSyncPushFixture).operations[0]?.opType).toBe('sos.create');
    expect(SyncPushRequestSchema.parse(mobileSosCancelSyncPushFixture).operations[0]?.opType).toBe('sos.cancel');
    expect(SosConnectedCreateRequestSchema.parse(telegramSosCreateRequestFixture).channel).toBe('telegram');
    expect(SosAlertStatusResponseSchema.parse(sosAlertStatusHappyFixture).fanout.queued).toBe(3);
    expect(SosAlertCreateResponseSchema.parse(sosAlertCreateResponseHappyFixture).sosAlert.status).toBe('open');
    expect(SosConnectedCreateRequestSchema.safeParse(sosApiFixtures.telegram.error).success).toBe(false);
    expect(SyncPushRequestSchema.safeParse(sosApiFixtures.mobile.error).success).toBe(true);
  });

  it('exposes shared valid and invalid web link request/session fixtures', () => {
    expect(WebLinkRequestSchema.parse(validWebLinkRequestFixture).scope).toBe('work_center.detail');
    expect(WebLinkSessionSchema.parse(validWebLinkSessionFixture).token).toBe('opaque-web-link-token-fixture');
    expect(WebLinkRequestSchema.safeParse(invalidWebLinkRequestFixture).success).toBe(false);
    expect(WebLinkSessionSchema.safeParse(invalidWebLinkSessionFixture).success).toBe(false);
  });

  it('exposes private family reunification web link fixtures', () => {
    expect(PrivateWebLinkIssueRequestSchema.parse(privateFamilyReunificationIssueRequestFixture).scope).toBe('family_reunification.search');
    expect(PrivateWebLinkIssueResponseSchema.parse(privateFamilyReunificationIssueResponseFixture).maxUses).toBe(1);
    expect(PrivateWebLinkValidateRequestSchema.parse(privateFamilyReunificationValidateRequestFixture).fingerprint).toBe('browser-fingerprint-fixture');
    expect(PrivateWebLinkValidateResponseSchema.parse(privateFamilyReunificationValidateResponseFixture).nextAction).toBe('in_person_verification');
    expect(PrivateWebLinkConsumeRequestSchema.parse(privateFamilyReunificationConsumeRequestFixture).referralReason).toBe('family_reunification_in_person_verification');
    expect(PrivateWebLinkConsumeResponseSchema.parse(privateFamilyReunificationConsumeResponseFixture).accepted).toBe(true);

    const searchResponse = FamilyReunificationSearchResponseSchema.parse(familyReunificationSearchResponseFixture);
    expect(FamilyReunificationSearchRequestSchema.parse(familyReunificationSearchRequestFixture).query.ageBand).toBe('child');
    expect(searchResponse.matches[0]?.reasonCode).toBe('family_reunification.match.family_desk_compare_details');
    expect(searchResponse.referral.reasonCode).toBe('family_reunification_in_person_verification');
    expect(searchResponse.referral.messageCode).toBe('family_reunification.referral.in_person_verification');
    expect(JSON.stringify(searchResponse)).not.toMatch(/photo|fullName|latitude|longitude|exactLocation/i);
    expect(JSON.stringify(searchResponse)).not.toMatch(/family desk|visit the family reunification desk/i);
  });



  it('exposes happy and error web link fixtures for every final Equipo A scope', () => {
    expect(Object.keys(webLinkFlowFixtures)).toEqual(['incident.join', 'work_center.detail', 'family_reunification.search']);

    for (const [scope, fixtures] of Object.entries(webLinkFlowFixtures)) {
      expect(WebLinkRequestSchema.parse(fixtures.happy).scope).toBe(scope);
      expect(WebLinkRequestSchema.safeParse(fixtures.error).success).toBe(false);
    }
  });



  it('exposes happy and error incident fixtures for list, config, Telegram join and mobile join', () => {
    expect(IncidentListResponseSchema.parse(incidentListHappyFixture).incidents[0]?.incidentId).toBe('incident-zc-demo');
    expect(IncidentListResponseSchema.safeParse(incidentListErrorFixture).success).toBe(false);
    expect(IncidentConfigResponseSchema.parse(incidentConfigHappyFixture).roles).toEqual(['volunteer', 'coordinator', 'logistics', 'medical']);
    expect(IncidentConfigResponseSchema.safeParse(incidentConfigErrorFixture).success).toBe(false);

    expect(IncidentJoinRequestSchema.parse(telegramIncidentJoinRequestFixture).channel).toBe('telegram');
    expect(IncidentJoinRequestSchema.parse(incidentJoinFixtures.mobile.happy.request).channel).toBe('mobile');
    expect(IncidentJoinResponseSchema.parse(incidentJoinFixtures.telegram.happy.response).membership.role).toBe('volunteer');
    expect(IncidentJoinResponseSchema.parse(incidentJoinFixtures.mobile.happy.response).membership.role).toBe('medical');
    expect(IncidentJoinRequestSchema.safeParse(incidentJoinFixtures.telegram.error).success).toBe(false);
    expect(IncidentJoinRequestSchema.safeParse(incidentJoinFixtures.mobile.error).success).toBe(false);
  });

  it('exposes happy and error work center fixtures for Telegram, Web and Mobile consumers', () => {
    expect(WorkCenterConnectedCreateRequestSchema.parse(telegramWorkCenterCreateRequestFixture).channel).toBe('telegram');
    expect(WorkCenterConnectedCreateRequestSchema.parse(webWorkCenterCreateRequestFixture).channel).toBe('web-ui');
    expect(WorkCenterListResponseSchema.parse(workCenterListHappyFixture).workCenters[0]?.activationState).toBe('pending_corroboration');
    expect(WorkCenterDetailResponseSchema.parse(workCenterDetailHappyFixture).workCenter.latestSignals).toHaveLength(1);
    expect(WorkCenterCreateResponseSchema.parse(workCenterCreateResponseHappyFixture).idempotent).toBe(false);
    expect(WorkCenterConnectedCreateRequestSchema.safeParse(workCenterApiFixtures.telegram.error).success).toBe(false);
    expect(WorkCenterConnectedCreateRequestSchema.safeParse(workCenterApiFixtures.web.error).success).toBe(false);
    expect(SyncPushRequestSchema.safeParse(workCenterApiFixtures.mobile.error).success).toBe(false);
  });

  it('locks a golden compatibility vector for mobile canonicalization, fake signature and opId', () => {
    expect(signedOperationGoldenVector).toEqual({
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
    });
  });

  it('exposes a Telegram start update fixture for integration and e2e tests', () => {
    expect(telegramStartUpdateFixture.message.text).toBe('/start');
  });
});
