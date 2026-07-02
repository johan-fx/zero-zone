import { type SupportedLocale, formatMessage } from '@zona-cero/i18n';

import { PrivateWebLinkIssueRequestSchema, type PrivateWebLinkIssueRequest, type PrivateWebLinkIssueResponse } from '@zona-cero/contracts';

export function isFamilyReunificationCommand(command: string | null): boolean {
  return command === '/familia' || command === '/reunificacion';
}

export function createFamilyReunificationPrivateLinkRequest(): PrivateWebLinkIssueRequest {
  return PrivateWebLinkIssueRequestSchema.parse({
    scope: 'family_reunification.search',
    channel: 'web-ui',
    externalId: 'web-user-1001',
    displayName: 'Field Web',
    correlationId: 'corr-family-reunification-search-1',
    returnState: 'web:family-reunification:search',
    ttlSeconds: 600,
    maxUses: 1,
    metadata: {},
  });
}

export function formatFamilyReunificationPrivateUrl(response: PrivateWebLinkIssueResponse): string {
  const params = new URLSearchParams({
    token: response.token,
    correlationId: response.correlationId,
  });
  return `/family-reunification?${params.toString()}`;
}

export function formatFamilyReunificationLinkSuccess(locale: SupportedLocale, url: string): string {
  return formatMessage(locale, 'telegram.family.link.success', { url });
}

export function formatFamilyReunificationLinkError(locale: SupportedLocale = 'es'): string {
  return formatMessage(locale, 'telegram.family.link.error');
}

