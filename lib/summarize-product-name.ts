/** Max length for product names in DB. Keeps exports and UI clean. */
export const MAX_PRODUCT_NAME_LENGTH = 120

const FLUFF_PATTERNS = [
  /\b(?:SPECIFICATIONS?|FEATURES?|NOTE:|PLEASE NOTE|SUPPORTS?|COMPATIBLE WITH|IDEAL FOR|ALLOWS? YOU TO|DESIGNED FOR|PERFECT FOR)\s*[:\-]/gi,
  /\b(?:INPUT|OUTPUT|CONNECTOR|DIMENSIONS?|OS SUPPORT)\s*:/gi,
  /\s*\.\s*(?:FEATURES|NOTE|SPECIFICATION)/gi,
]

/**
 * Summarizes long product descriptions into concise names.
 * Strips marketing fluff, specs sections, redundant text. Keeps brand, model, product type.
 */
export function summarizeProductName(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (s.length <= MAX_PRODUCT_NAME_LENGTH) return s

  // Strip known fluff sections (everything from first match onward)
  for (const re of FLUFF_PATTERNS) {
    const idx = s.search(re)
    if (idx >= 20) {
      s = s.slice(0, idx).trim()
      break
    }
  }

  // Take first sentence if period-separated
  const firstSentence = s.split(/\.\s+/)[0]?.trim()
  if (firstSentence && firstSentence.length >= 20 && firstSentence.length <= MAX_PRODUCT_NAME_LENGTH) {
    return firstSentence
  }
  if (firstSentence && firstSentence.length > MAX_PRODUCT_NAME_LENGTH) {
    s = firstSentence
  }

  // Split on comma/semicolon – take first meaningful segment
  const segments = s.split(/[,;]/).map((x) => x.trim()).filter(Boolean)
  if (segments.length > 1) {
    const first = segments[0]!
    if (first.length >= 20 && first.length <= MAX_PRODUCT_NAME_LENGTH) return first
    // First segment too short – join first two, truncate
    const combined = segments.slice(0, 2).join(' – ')
    if (combined.length <= MAX_PRODUCT_NAME_LENGTH) return combined
    s = combined
  }

  // Truncate at word boundary
  if (s.length > MAX_PRODUCT_NAME_LENGTH) {
    const cut = s.slice(0, MAX_PRODUCT_NAME_LENGTH)
    const lastSpace = cut.lastIndexOf(' ')
    s = lastSpace > MAX_PRODUCT_NAME_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut
  }

  return s.trim()
}
