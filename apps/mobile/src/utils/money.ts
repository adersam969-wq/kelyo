/**
 * Format an integer amount of XAF for display.
 * Examples: formatXAF(25000) => "25 000 XAF"
 */
export function formatXAF(amount: number): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} XAF`;
}

/**
 * Parse a user-typed amount string into an integer XAF.
 * Accepts: "25000", "25 000", "25,000". Rejects decimals (XAF has no subunit).
 */
export function parseAmount(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[\s,]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
