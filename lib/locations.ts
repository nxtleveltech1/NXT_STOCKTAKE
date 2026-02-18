/**
 * Single source of truth for stock locations across the platform.
 * Used by: locations API, zones API, items PATCH, ProductProfileSheet, filters.
 */

export const ALLOWED_LOCATIONS = [
  'NXT/NXT STOCK',
  'NXT/NXT STOCK/Rental',
  'NXT/NXT STOCK/Secondhand',
  'NXT/NXT STOCK/Studio Rentals',
  'NXT/NXT STOCK/Repairs',
] as const

export type AllowedLocation = (typeof ALLOWED_LOCATIONS)[number]

export function isAllowedLocation(loc: string): loc is AllowedLocation {
  return (ALLOWED_LOCATIONS as readonly string[]).includes(loc)
}
