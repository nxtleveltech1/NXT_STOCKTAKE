import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rows = await db.stockItem.findMany({
    where: { supplier: { not: null } },
    select: { supplier: true },
    distinct: ['supplier'],
    orderBy: { supplier: 'asc' },
  })
  const suppliers = rows
    .map((r) => r.supplier)
    .filter((s): s is string => !!s && s.trim() !== '')
  return NextResponse.json(suppliers)
}
