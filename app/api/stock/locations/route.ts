import { NextResponse } from 'next/server'

const ALLOWED_LOCATIONS = [
  'All Zones',
  'NXT/NXT STOCK',
  'NXT/NXT STOCK RENTAL',
] as const

export async function GET() {
  return NextResponse.json([...ALLOWED_LOCATIONS])
}
