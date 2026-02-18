import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const rows = await db.stockItem.findMany({
    where: { organizationId: orgId, warehouse: { not: null } },
    select: { warehouse: true },
    distinct: ['warehouse'],
    orderBy: { warehouse: 'asc' },
  })
  const warehouses = rows
    .map((r) => r.warehouse)
    .filter((w): w is string => !!w && w.trim() !== '')
  return NextResponse.json(warehouses)
}
