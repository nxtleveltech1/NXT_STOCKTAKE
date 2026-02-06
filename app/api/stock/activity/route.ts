import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { orgId } = await auth()
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  const where: { organizationId?: string | null } = orgId
    ? { organizationId: orgId }
    : { organizationId: null }

  const rows = await db.stockActivity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const events = rows.map((r) => ({
    id: r.id,
    type: r.type as 'count' | 'variance' | 'verify' | 'join' | 'zone_complete',
    message: r.message,
    user: r.userName ?? r.userId ?? 'Unknown',
    timestamp: formatTimestamp(r.createdAt),
    zone: r.zone ?? undefined,
  }))

  return NextResponse.json(events)
}

function formatTimestamp(d: Date): string {
  const now = Date.now()
  const then = new Date(d).getTime()
  const diffMs = now - then
  if (diffMs < 60_000) return 'Just now'
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)}h ago`
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
