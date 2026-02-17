/**
 * Barcode validation utilities for EAN-13, EAN-8, UPC-A, UPC-E, CODE_128, QR.
 * Rejects misreads (e.g. wrong checksum) before they reach the API.
 */

export type BarcodeValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; error: string }

/** EAN-13 checksum (modulo 10) */
function ean13Checksum(digits: number[]): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += digits[i]! * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

/** EAN-8 checksum (modulo 10) */
function ean8Checksum(digits: number[]): number {
  let sum = 0
  for (let i = 0; i < 7; i++) {
    sum += digits[i]! * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10
}

/** UPC-A is 12 digits; same checksum as EAN-13 (first 11 + check) */
function upcaChecksum(digits: number[]): number {
  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += digits[i]! * (i % 2 === 0 ? 1 : 3)
  }
  return (10 - (sum % 10)) % 10
}

/** UPC-E is 8 digits (NS + 6 data + check); validate check digit via expansion to UPC-A */
function upceChecksum(digits: number[]): boolean {
  const expanded = upceExpand(digits)
  if (!expanded) return false
  const expected = upcaChecksum(expanded)
  return digits[7] === expected
}

/** Expand UPC-E (8 digits) to UPC-A (12 digits) for checksum validation */
function upceExpand(digits: number[]): number[] | null {
  const ns = digits[0]
  if (ns === undefined || ns > 2) return null
  const d = digits.slice(1, 7) // 6 data digits
  if (d.length !== 6) return null
  let expanded: string
  if (ns === 0) {
    expanded = "0" + d[0] + d[1] + d[2] + "00000" + d[3] + d[4] + d[5]
  } else if (ns === 1) {
    expanded = "0" + d[0] + d[1] + d[2] + d[3] + "00000" + d[4] + d[5]
  } else {
    expanded = "0" + d[0] + d[1] + d[2] + d[3] + d[4] + "00000" + d[5]
  }
  return expanded.split("").map(Number)
}

/**
 * Validate barcode by format. Rejects invalid checksums for EAN/UPC.
 * CODE_128 and QR have no standard checksum; we validate length/format only.
 */
export function validateBarcode(
  value: string,
  format?: string
): BarcodeValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: false, error: "Empty barcode" }

  const digits = trimmed.replace(/\D/g, "").split("").map(Number)
  const isNumeric = digits.length === trimmed.length && digits.every((d) => !Number.isNaN(d))

  // EAN-13: 13 digits, checksum
  if (format === "EAN_13" || (!format && isNumeric && digits.length === 13)) {
    if (digits.length !== 13) return { valid: false, error: "EAN-13 must be 13 digits" }
    const expected = ean13Checksum(digits)
    if (digits[12] !== expected) {
      return { valid: false, error: `Invalid EAN-13 checksum (expected ${expected})` }
    }
    return { valid: true, normalized: trimmed }
  }

  // EAN-8: 8 digits, checksum (when format is EAN_8 or 8 digits with valid EAN-8)
  if (format === "EAN_8" || (!format && isNumeric && digits.length === 8)) {
    if (digits.length !== 8) return { valid: false, error: "EAN-8 must be 8 digits" }
    const expected = ean8Checksum(digits)
    if (digits[7] === expected) return { valid: true, normalized: trimmed }
    if (format === "EAN_8") {
      return { valid: false, error: `Invalid EAN-8 checksum (expected ${expected})` }
    }
    // No format: try UPC-E as fallback for 8 digits
  }

  // UPC-A: 12 digits, checksum
  if (format === "UPC_A" || (!format && isNumeric && digits.length === 12)) {
    if (digits.length !== 12) return { valid: false, error: "UPC-A must be 12 digits" }
    const expected = upcaChecksum(digits)
    if (digits[11] !== expected) {
      return { valid: false, error: `Invalid UPC-A checksum (expected ${expected})` }
    }
    return { valid: true, normalized: trimmed }
  }

  // UPC-E: 8 digits
  if (format === "UPC_E" || (!format && isNumeric && digits.length === 8)) {
    if (digits.length !== 8) return { valid: false, error: "UPC-E must be 8 digits" }
    if (!upceChecksum(digits)) {
      return { valid: false, error: "Invalid UPC-E checksum" }
    }
    return { valid: true, normalized: trimmed }
  }

  // CODE_128: alphanumeric, typically 6–20 chars for product barcodes
  if (format === "CODE_128" || (!format && trimmed.length >= 4 && trimmed.length <= 80)) {
    if (trimmed.length < 4) return { valid: false, error: "CODE_128 too short" }
    return { valid: true, normalized: trimmed }
  }

  // QR_CODE: accept most strings
  if (format === "QR_CODE" || (!format && trimmed.length > 0)) {
    return { valid: true, normalized: trimmed }
  }

  // Fallback: if numeric 8–13 digits, try EAN/UPC by length
  if (isNumeric && digits.length >= 8 && digits.length <= 13) {
    if (digits.length === 13) return validateBarcode(trimmed, "EAN_13")
    if (digits.length === 12) return validateBarcode(trimmed, "UPC_A")
    if (digits.length === 8) {
      const ean8 = validateBarcode(trimmed, "EAN_8")
      if (ean8.valid) return ean8
      return validateBarcode(trimmed, "UPC_E")
    }
  }

  // Generic: accept if non-empty and reasonable length
  if (trimmed.length >= 4 && trimmed.length <= 80) {
    return { valid: true, normalized: trimmed }
  }

  return { valid: false, error: "Unrecognized barcode format" }
}
