/**
 * Money utilities for Kelyo.
 *
 * XAF (Central African CFA franc) has no subdivision — the smallest unit is 1 XAF.
 * We store all amounts as PostgreSQL BIGINT (integer XAF) to avoid floating-point
 * errors. NEVER use floats for money in this codebase.
 */

export const MAX_AMOUNT = 1_000_000_000; // 1 billion XAF — sanity ceiling

export function assertValidAmount(amount: unknown): asserts amount is number {
  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    throw new Error('Amount must be an integer');
  }
  if (amount <= 0) throw new Error('Amount must be strictly positive');
  if (amount > MAX_AMOUNT) throw new Error(`Amount exceeds max (${MAX_AMOUNT})`);
}

export function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(amount);
}
