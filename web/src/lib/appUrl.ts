const DEFAULT_ORIGIN = 'http://localhost:5173'

/** Build an absolute app URL without double slashes in the path. */
export function buildAppUrl(origin: string | undefined, path: string): string {
  const base = (origin?.trim() || DEFAULT_ORIGIN).replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
