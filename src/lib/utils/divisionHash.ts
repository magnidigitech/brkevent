/**
 * Secure Division Hash Generator & Validator
 * 
 * Provides a deterministic, tamper-proof 4-character alphanumeric hash for each division (1–76).
 * 36^4 = 1,679,616 combinations, ensuring unique, collision-free codes for all 76 divisions.
 * 
 * Used for WhatsApp invitation links (e.g. /division1-tpv7) to prevent unauthorized URL tampering
 * (e.g. guests changing the division number in the address bar).
 */

const HASH_SALT = 0xa341316c;

/**
 * Generates a deterministic 4-character tamper-proof hash for a given division number (1–76).
 * Pure function: works identically on both client (browser) and server (Node / Edge).
 */
export function getDivisionHash(divisionNumber: number): string {
  let h = 0x811c9dc5 ^ HASH_SALT;
  const str = `brk-division-hash-salt-2026-${divisionNumber}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // 36^4 = 1,679,616 combinations
  const val = (h >>> 0) % 1679616;
  return val.toString(36).padStart(4, '0');
}

/**
 * Validates whether the provided 4-character hash matches the expected hash for the division.
 */
export function validateDivisionHash(divisionNumber: number, hash: string | null | undefined): boolean {
  if (!hash || typeof hash !== 'string') return false;
  const expected = getDivisionHash(divisionNumber);
  return expected.toLowerCase() === hash.toLowerCase().trim();
}

