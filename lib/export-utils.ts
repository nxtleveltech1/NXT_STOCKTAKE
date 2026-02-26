/** Max length for product/description fields in exports. Prevents CSV/Excel corruption. */
export const MAX_EXPORT_TEXT_LENGTH = 200

/**
 * Sanitizes text for CSV/Excel export: truncates, strips control chars, normalizes whitespace.
 */
export function sanitizeForExport(val: unknown, maxLen = MAX_EXPORT_TEXT_LENGTH): string {
  if (val == null) return ''
  let s = String(val)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // strip control chars
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > maxLen) s = s.slice(0, maxLen - 1) + '…'
  return s
}

/**
 * RFC 4180 CSV escape: quote fields containing comma, quote, or newline.
 */
export function escapeCsv(val: unknown): string {
  if (val == null) return ''
  const s = String(val).replace(/\r\n|\r|\n/g, ' ')
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
}
