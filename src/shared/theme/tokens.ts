export type OperationalThemeName = 'light' | 'dark';
export type ThemePreference = 'system' | 'day' | 'night';
export type StatusTone = 'info' | 'success' | 'warning' | 'risk' | 'sos' | 'stale' | 'pending' | 'conflict';

export const operationalThemeAliases = {
  day: 'light',
  night: 'dark',
} as const satisfies Record<'day' | 'night', OperationalThemeName>;

export const operationalThemePalettes = {
  light: {
    background: '#EEF3F7',
    surface: '#FFFFFF',
    surfaceMuted: '#F7FAFC',
    surfaceElevated: '#FFFFFF',
    border: '#CBD5E1',
    borderStrong: '#94A3B8',
    text: '#0F172A',
    textMuted: '#475569',
    textInverse: '#F8FAFC',
    primary: '#1D64D8',
    primarySurface: '#E8F1FF',
    info: '#2563EB',
    infoSurface: '#DBEAFE',
    success: '#2F8F46',
    successSurface: '#DCFCE7',
    warning: '#D97706',
    warningSurface: '#FEF3C7',
    risk: '#EA580C',
    riskSurface: '#FFEDD5',
    sos: '#DC2626',
    sosSurface: '#FEE2E2',
    stale: '#B45309',
    staleSurface: '#FEF3C7',
    pending: '#CA8A04',
    pendingSurface: '#FEF9C3',
    conflict: '#B91C1C',
    conflictSurface: '#FEE2E2',
    mapBase: '#E8EEF3',
    mapWater: '#BFE3F7',
    mapRoute: '#2563EB',
  },
  dark: {
    background: '#07111F',
    surface: '#0D1B2A',
    surfaceMuted: '#12263A',
    surfaceElevated: '#142B42',
    border: '#29435C',
    borderStrong: '#3F5F7B',
    text: '#F8FAFC',
    textMuted: '#B6C3D1',
    textInverse: '#0F172A',
    primary: '#4D8DFF',
    primarySurface: '#123A68',
    info: '#60A5FA',
    infoSurface: '#0F3558',
    success: '#63C174',
    successSurface: '#123D26',
    warning: '#F5B84B',
    warningSurface: '#4A320B',
    risk: '#FF8A3D',
    riskSurface: '#4A210D',
    sos: '#FF4D4F',
    sosSurface: '#4F1115',
    stale: '#FBBF24',
    staleSurface: '#44320A',
    pending: '#FACC15',
    pendingSurface: '#3F3308',
    conflict: '#FF6B6B',
    conflictSurface: '#4B1111',
    mapBase: '#102235',
    mapWater: '#16486E',
    mapRoute: '#60A5FA',
  },
} as const;

export const operationalRadii = {
  card: 18,
  panel: 24,
  control: 12,
  pill: 999,
} as const;

export const operationalControlHeights = {
  action: 44,
  criticalAction: 48,
  badge: 30,
} as const;

export const operationalFontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 34,
} as const;

export const operationalLineHeights = {
  xs: 16,
  sm: 19,
  md: 22,
  lg: 25,
  xl: 29,
  xxl: 34,
  hero: 40,
} as const;

export const operationalSpacing = {
  section: 12,
  panel: 16,
  map: 12,
  sheet: 20,
} as const;

export const operationalElevation = {
  none: 0,
  soft: 0.04,
  raised: 0.12,
  floating: 0.18,
} as const;

export const operationalOpacity = {
  pressed: 0.82,
  disabled: 0.48,
  selected: 1,
} as const;

export const operationalZIndex = {
  mapOverlay: 10,
  stickyPanel: 20,
  bottomSheet: 30,
  criticalAlert: 40,
} as const;

export const operationalLayout = {
  borderWidth: 1,
  minTouchTarget: 48,
  elevatedShadowOpacity: 0.12,
} as const;

export const statusToneLabels = {
  info: 'Info',
  success: 'Confirmed',
  warning: 'Warning',
  risk: 'Risk',
  sos: 'SOS',
  stale: 'Stale',
  pending: 'Pending',
  conflict: 'Conflict',
} as const satisfies Record<StatusTone, string>;

export const statusToneMarkers = {
  info: 'i',
  success: '✓',
  warning: '!',
  risk: '!',
  sos: 'SOS',
  stale: 'STALE',
  pending: '…',
  conflict: '!',
} as const satisfies Record<StatusTone, string>;
