/**
 * Validate that a string looks like a valid email address.
 * Checks for basic structure: non-empty local part, @, non-empty domain with a dot.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Normalize an email address for deduplication:
 *  - Trims whitespace
 *  - Lowercases the entire address
 *  - Strips plus aliases (user+tag@domain → user@domain)
 *
 * This prevents the same person from voting multiple times using
 * variations like "user+a@gmail.com" and "user+b@gmail.com".
 */
export function normalizeEmail(email: string): string {
  const lower = email.trim().toLowerCase();
  const [localPart, domain] = lower.split('@');
  if (!localPart || !domain) return lower;
  const stripped = localPart.split('+')[0];
  return `${stripped}@${domain}`;
}
