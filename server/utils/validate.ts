/**
 * Shared input validation helpers used by all server routes.
 * Pure functions — no DB access, fully unit-testable.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const VALID_SURFACES = ['clay', 'hard', 'grass', 'indoor'] as const
export type Surface = (typeof VALID_SURFACES)[number]

/** True when value is a valid UUID (any version). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** True when value is one of the four recognised surface strings. */
export function isValidSurface(value: unknown): value is Surface {
  return VALID_SURFACES.includes(value as Surface)
}

/** True when value matches YYYY-MM-DD. */
export function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * True when value is a non-empty string ≤ 100 characters (after trimming).
 * Use for the `name` field on players.
 */
export function isValidName(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const t = value.trim()
  return t.length > 0 && t.length <= 100
}

/**
 * True when value is acceptable as avatar_url:
 *   - undefined / null → acceptable (no avatar)
 *   - string          → must be a valid https URL
 * Returns false for non-string non-null values or http/invalid URLs.
 */
export function isValidAvatarUrl(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}
