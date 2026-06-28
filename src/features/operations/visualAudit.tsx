import { ReactElement } from 'react';

import { OperationalMapScreen, SelectedCenterPanel, SosOutboxScreen } from './screens';

export type VisualAuditScreenId = 'operational-map' | 'selected-center' | 'sos-outbox';
export type VisualAuditThemeId = 'day' | 'night';

export type VisualAuditScreenConfig = {
  id: VisualAuditScreenId;
  title: string;
  expectedText: string;
  render: () => ReactElement;
};

export const visualAuditScreenConfigs = {
  'operational-map': {
    id: 'operational-map',
    title: 'Operational map',
    expectedText: 'Available',
    render: () => <OperationalMapScreen />,
  },
  'selected-center': {
    id: 'selected-center',
    title: 'Selected center',
    expectedText: 'Escuela Norte',
    render: () => <SelectedCenterPanel />,
  },
  'sos-outbox': {
    id: 'sos-outbox',
    title: 'SOS and outbox',
    expectedText: 'SOS raised',
    render: () => <SosOutboxScreen />,
  },
} as const satisfies Record<VisualAuditScreenId, VisualAuditScreenConfig>;

export function resolveVisualAuditScreenId(value: unknown): VisualAuditScreenId {
  return value === 'selected-center' || value === 'sos-outbox' ? value : 'operational-map';
}

export function resolveVisualAuditThemeId(value: unknown): VisualAuditThemeId {
  return value === 'night' ? 'night' : 'day';
}
