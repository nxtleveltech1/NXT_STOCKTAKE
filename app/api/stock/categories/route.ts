import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rows = await db.stockItem.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  const categories = rows
    .map((r) => r.category)
    .filter((c): c is string => !!c && c.trim() !== '')
  return NextResponse.json(categories)
}
