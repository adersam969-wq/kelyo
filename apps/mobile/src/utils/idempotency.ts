/**
 * Generate a fresh idempotency key — used for every wallet-altering request.
 * Format: random base64url-like string, 32 chars (server requires 16-128).
 *
 * No Buffer dependency — works on React Native out of the box.
 */
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function generateIdempotencyKey(length = 32): string {
  const arr = new Uint8Array(length);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
  } else {
    // Fallback (should not run on modern RN): not cryptographically strong
    for (let i = 0; i < length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[arr[i] % ALPHABET.length];
  return out;
}
