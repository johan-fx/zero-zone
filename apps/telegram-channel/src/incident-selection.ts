import { formatMessage, type SupportedLocale } from '@zona-cero/i18n';

import { IncidentRoleSchema, type IncidentJoinResponse, type IncidentRole, type IncidentSummary } from '@zona-cero/contracts';

export function selectIncident(incidents: IncidentSummary[], text: string): IncidentSummary | null {
  const index = Number.parseInt(text, 10);
  if (Number.isInteger(index) && String(index) === text && index >= 1 && index <= incidents.length) {
    return incidents[index - 1] ?? null;
  }

  return incidents.find((incident) => incident.incidentId === text) ?? null;
}

export type IncidentHintSelection =
  | { status: 'none' }
  | { status: 'single'; incident: IncidentSummary }
  | { status: 'ambiguous'; incidents: IncidentSummary[] };

export function selectIncidentBySafeHint(incidents: IncidentSummary[], hint: string | null | undefined): IncidentHintSelection {
  const normalizedHint = normalizeIncidentHint(hint);
  if (!normalizedHint) return { status: 'none' };

  const matches = incidents.filter((incident) => {
    const candidates = [incident.incidentId, incident.name, incident.locationName].map(normalizeIncidentHint);
    return candidates.includes(normalizedHint);
  });

  const uniqueMatches = Array.from(new Map(matches.map((incident) => [incident.incidentId, incident])).values());
  if (uniqueMatches.length === 1 && uniqueMatches[0]) return { status: 'single', incident: uniqueMatches[0] };
  if (uniqueMatches.length > 1) return { status: 'ambiguous', incidents: uniqueMatches };
  return { status: 'none' };
}

export function selectRole(roles: IncidentRole[], text: string): IncidentRole | null {
  const index = Number.parseInt(text, 10);
  const candidate = Number.isInteger(index) && String(index) === text ? roles[index - 1] : text;
  const parsed = IncidentRoleSchema.safeParse(candidate);

  if (!parsed.success || !roles.includes(parsed.data)) {
    return null;
  }

  return parsed.data;
}

function normalizeIncidentHint(value: string | null | undefined): string | null {
  const normalized = value
    ?.trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  return normalized || null;
}

export function formatIncidentList(incidents: IncidentSummary[]): string {
  return incidents.map((incident, index) => `${index + 1}. ${incident.name} — ${incident.locationName} (${incident.incidentId})`).join('\n');
}

export function formatRoles(roles: IncidentRole[]): string {
  return roles.map((role, index) => `${index + 1}. ${role}`).join('\n');
}

export function formatJoinSuccess(locale: SupportedLocale, response: IncidentJoinResponse): string {
  return formatMessage(locale, 'telegram.join.success', {
    incidentName: response.incident.name,
    role: response.membership.role,
    permissions: formatPermissions(response.membership.permissions),
    auditEventId: response.audit.auditEventId,
  });
}

export function formatPermissions(permissions: IncidentJoinResponse['membership']['permissions']): string {
  return Object.entries(permissions)
    .filter(([, enabled]) => enabled)
    .map(([permission]) => permission)
    .join(', ');
}
