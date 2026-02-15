import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rows = await db.stockItem.findMany({
    where: { location: { not: '' } },
    select: { location: true },
    distinct: ['location'],
    orderBy: { location: 'asc' },
  })
  const fromDb = rows.map((r) => r.location).filter(Boolean)
  const locations = ['All Zones', ...fromDb]
  return NextResponse.json(locations)
}
