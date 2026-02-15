import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rows = await db.stockItem.findMany({
    where: { warehouse: { not: null } },
    select: { warehouse: true },
    distinct: ['warehouse'],
    orderBy: { warehouse: 'asc' },
  })
  const warehouses = rows
    .map((r) => r.warehouse)
    .filter((w): w is string => !!w && w.trim() !== '')
  return NextResponse.json(warehouses)
}
