import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const rows = await db.stockItem.findMany({
    where: { organizationId: orgId, category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  const categories = rows
    .map((r) => r.category)
    .filter((c): c is string => !!c && c.trim() !== '')
  return NextResponse.json(categories)
}
