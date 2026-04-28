/**
 * Kelyo design tokens.
 * Mirrors @kelyo/shared/constants but redeclared here to avoid Metro bundler workspace pain.
 * Keep in sync with packages/shared/src/constants.ts.
 */

export const theme = {
  colors: {
    primary: {
      50: '#EBF5FF',
      100: '#D4E9FF',
      200: '#A8D2FF',
      300: '#75B5FF',
      400: '#3D90FF',
      500: '#0D6EFD',
      600: '#0958CC',
      700: '#074199',
      800: '#052E6B',
      900: '#031A3D',
    },
    secondary: {
      50: '#E6FAF1',
      100: '#C2F2DD',
      200: '#85E5BB',
      300: '#48D899',
      400: '#1DCB7C',
      500: '#0FB969',
      600: '#0C9655',
      700: '#097342',
      800: '#06502E',
      900: '#03331D',
    },
    success: '#0FB969',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#0D6EFD',
    neutral: {
      0: '#FFFFFF',
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 6, md: 12, lg: 16, xl: 24, full: 9999 },
  typography: {
    h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
    h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  },
} as const;

export type Theme = typeof theme;
