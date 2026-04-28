/**
 * Phone number normalization to E.164 format.
 * Stored format: +<country><number> with no spaces, no dashes, no parens.
 *
 * MVP focuses on CEMAC zone — Gabon defaults if no country code provided.
 */

const CEMAC_DIAL_CODES: Record<string, string> = {
  GA: '+241',
  CM: '+237',
  CG: '+242',
  CF: '+236',
  TD: '+235',
  GQ: '+240',
};

export function normalizePhone(input: string, defaultCountry = 'GA'): string {
  const cleaned = input.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+')) {
    if (!/^\+\d{8,15}$/.test(cleaned)) {
      throw new Error('Invalid phone format');
    }
    return cleaned;
  }
  if (cleaned.startsWith('00')) {
    return `+${cleaned.substring(2)}`;
  }
  const dial = CEMAC_DIAL_CODES[defaultCountry];
  if (!dial) throw new Error(`Unsupported default country: ${defaultCountry}`);
  return `${dial}${cleaned}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return `${phone.substring(0, 4)}****${phone.substring(phone.length - 2)}`;
}
