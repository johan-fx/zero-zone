import { defaultConfig } from '@tamagui/config/v5';
import { createFont, createTamagui, isWeb } from 'tamagui';

import {
  operationalFontSizes,
  operationalLineHeights,
  operationalRadii,
  operationalSpacing,
  operationalThemePalettes,
  operationalZIndex,
  type OperationalThemeName,
} from './src/shared/theme/tokens';

const lightPalette = operationalThemePalettes.light;
const darkPalette = operationalThemePalettes.dark;

type OperationalPalette = (typeof operationalThemePalettes)[OperationalThemeName];

const buildTheme = (palette: OperationalPalette) => ({
  ...palette,
  background: palette.background,
  backgroundHover: palette.surfaceMuted,
  backgroundPress: palette.surfaceMuted,
  backgroundFocus: palette.surfaceMuted,
  color: palette.text,
  colorHover: palette.text,
  colorPress: palette.text,
  colorFocus: palette.text,
  colorTransparent: 'transparent',
  borderColor: palette.border,
  borderColorHover: palette.borderStrong,
  borderColorPress: palette.borderStrong,
  borderColorFocus: palette.primary,
  placeholderColor: palette.textMuted,
});

const operationalBodyFont = createFont({
  family: isWeb ? 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : 'System',
  size: {
    ...operationalFontSizes,
    true: operationalFontSizes.md,
  },
  lineHeight: {
    ...operationalLineHeights,
    true: operationalLineHeights.md,
  },
  weight: {
    regular: '400',
    medium: '600',
    bold: '800',
    black: '900',
    true: '400',
  },
  letterSpacing: {
    tight: -0.4,
    normal: 0,
    wide: 1,
    true: 0,
  },
});

const operationalMonoFont = createFont({
  family: isWeb ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace' : 'Courier',
  size: {
    ...operationalFontSizes,
    true: operationalFontSizes.sm,
  },
  lineHeight: {
    ...operationalLineHeights,
    true: operationalLineHeights.sm,
  },
  weight: {
    regular: '400',
    bold: '700',
    true: '400',
  },
  letterSpacing: {
    normal: 0,
    wide: 0.6,
    true: 0,
  },
});

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  fonts: {
    ...defaultConfig.fonts,
    body: operationalBodyFont,
    heading: operationalBodyFont,
    mono: operationalMonoFont,
  },
  tokens: {
    ...defaultConfig.tokens,
    radius: {
      ...defaultConfig.tokens.radius,
      card: operationalRadii.card,
      panel: operationalRadii.panel,
      control: operationalRadii.control,
      pill: operationalRadii.pill,
    },
    space: {
      ...defaultConfig.tokens.space,
      ...operationalSpacing,
    },
    size: {
      ...defaultConfig.tokens.size,
      touch: 48,
      marker: 42,
      bottomSheetPeek: 88,
    },
    zIndex: {
      ...defaultConfig.tokens.zIndex,
      ...operationalZIndex,
    },
    color: {
      ...lightPalette,
      ...Object.fromEntries(Object.entries(darkPalette).map(([key, value]) => [`dark_${key}`, value])),
    },
  },
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      ...buildTheme(lightPalette),
    },
    dark: {
      ...defaultConfig.themes.dark,
      ...buildTheme(darkPalette),
    },
  },
});

export default tamaguiConfig;

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
