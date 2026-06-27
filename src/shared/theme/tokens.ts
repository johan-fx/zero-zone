export const colors = {
  light: {
    background: '#F6F8FB',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0B1220',
    muted: '#526070',
    accent: '#D9480F',
    border: '#DCE3EA',
  },
  dark: {
    background: '#07111F',
    surface: '#0D1B2A',
    card: '#102235',
    text: '#F8FAFC',
    muted: '#A8B3C2',
    accent: '#FFB86B',
    border: '#213247',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 12,
  lg: 18,
  xl: 28,
  full: 999,
} as const;
