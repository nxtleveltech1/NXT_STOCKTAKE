import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const where = {
    organizationId: orgId,
    lastCountedBy: { not: null } as const,
    ...(status && status !== 'all' ? { status } : {}),
  }

  const rows = await db.stockItem.findMany({
    where,
    select: { lastCountedBy: true },
    distinct: ['lastCountedBy'],
    orderBy: { lastCountedBy: 'asc' },
  })

  const counters = rows
    .map((r) => r.lastCountedBy)
    .filter((c): c is string => !!c && c.trim() !== '')

  return NextResponse.json(counters)
}
