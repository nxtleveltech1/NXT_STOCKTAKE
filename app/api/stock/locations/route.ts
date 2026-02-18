import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_LOCATIONS } from '@/lib/locations'

export async function GET() {
  const rows = await db.stockItem.findMany({
    where: { location: { not: '' } },
    select: { location: true },
    distinct: ['location'],
    orderBy: { location: 'asc' },
  })
  const fromDb = new Set(rows.map((r) => r.location).filter(Boolean))
  const canonical = [...ALLOWED_LOCATIONS]
  const extra = [...fromDb].filter((l) => !canonical.includes(l)).sort()
  const locations = ['All Zones', ...canonical, ...extra]
  return NextResponse.json(locations)
}
