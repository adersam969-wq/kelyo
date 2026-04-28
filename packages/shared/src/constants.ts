/**
 * Kelyo brand colors — fintech blue/green palette.
 * Use these tokens consistently across mobile (RN) and web (Tailwind).
 */
export const KELYO_COLORS = {
  // Primary — deep trust blue
  primary: {
    50: '#EBF5FF',
    100: '#D4E9FF',
    200: '#A8D2FF',
    300: '#75B5FF',
    400: '#3D90FF',
    500: '#0D6EFD', // main
    600: '#0958CC',
    700: '#074199',
    800: '#052E6B',
    900: '#031A3D',
  },
  // Secondary — vibrant fintech green (success, money in)
  secondary: {
    50: '#E6FAF1',
    100: '#C2F2DD',
    200: '#85E5BB',
    300: '#48D899',
    400: '#1DCB7C',
    500: '#0FB969', // main
    600: '#0C9655',
    700: '#097342',
    800: '#06502E',
    900: '#03331D',
  },
  // Semantic
  success: '#0FB969',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#0D6EFD',
  // Neutrals
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
} as const;

export const SUPPORTED_COUNTRIES = [
  { code: 'GA', name: 'Gabon', dialCode: '+241', currency: 'XAF' },
  { code: 'CM', name: 'Cameroun', dialCode: '+237', currency: 'XAF' },
  { code: 'CG', name: 'Congo', dialCode: '+242', currency: 'XAF' },
  { code: 'CF', name: 'République Centrafricaine', dialCode: '+236', currency: 'XAF' },
  { code: 'TD', name: 'Tchad', dialCode: '+235', currency: 'XAF' },
  { code: 'GQ', name: 'Guinée Équatoriale', dialCode: '+240', currency: 'XAF' },
] as const;

export const PAYMENT_CHANNEL_LABELS = {
  AIRTEL_MONEY: 'Airtel Money',
  MOOV_MONEY: 'Moov Money',
  CARD_VISA: 'Carte Visa',
  CARD_MASTERCARD: 'Carte Mastercard',
  KELYO_WALLET: 'Wallet Kelyo',
} as const;

export const QR_PAYLOAD_PREFIX = 'KELYO:';
export const PAYMENT_LINK_BASE_PATH = '/pay';
