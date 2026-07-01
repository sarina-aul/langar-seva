const CANADIAN_POSTAL_RE =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i

/** Normalize a Canadian postal code to "A1A 1A1", or null if invalid. */
export function normalizePostalCode(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const compact = trimmed.replace(/\s+/g, '').toUpperCase()
  if (!CANADIAN_POSTAL_RE.test(compact)) return null

  return `${compact.slice(0, 3)} ${compact.slice(3)}`
}

export function postalPrefix(raw: string): string | null {
  const normalized = normalizePostalCode(raw)
  return normalized ? normalized.replace(/\s+/g, '').slice(0, 3) : null
}

export function isValidPostalCode(raw: string): boolean {
  return normalizePostalCode(raw) !== null
}

export const POSTAL_CODE_HINT = 'Example: L6P 2X1'
