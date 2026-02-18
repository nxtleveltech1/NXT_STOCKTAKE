import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const rows = await db.stockItem.findMany({
    where: { organizationId: orgId, supplier: { not: null } },
    select: { supplier: true },
    distinct: ['supplier'],
    orderBy: { supplier: 'asc' },
  })
  const suppliers = rows
    .map((r) => r.supplier)
    .filter((s): s is string => !!s && s.trim() !== '')
  return NextResponse.json(suppliers)
}
