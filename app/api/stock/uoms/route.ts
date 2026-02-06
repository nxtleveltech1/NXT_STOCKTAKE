import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const COMMON_UOMS = [
  'Unit',
  'Each',
  'Box',
  'Case',
  'Pack',
  'Pair',
  'Dozen',
  'Kg',
  'Lb',
  'Litre',
  'Meter',
  'None',
]

export async function GET() {
  const rows = await db.stockItem.findMany({
    where: { uom: { not: null } },
    select: { uom: true },
    distinct: ['uom'],
  })
  const fromDb = rows
    .map((r) => r.uom)
    .filter((u): u is string => !!u && u.trim() !== '')
  const combined = [...new Set([...COMMON_UOMS, ...fromDb])].sort()
  return NextResponse.json(combined)
}
