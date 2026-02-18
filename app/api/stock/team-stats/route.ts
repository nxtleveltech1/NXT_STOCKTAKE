import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const [assignments, activities] = await Promise.all([
    db.zoneAssignment.findMany({
      where: { organizationId: orgId },
      select: { userId: true, zoneCode: true },
    }),
    db.stockActivity.findMany({
      where: {
        organizationId: orgId,
        userId: { not: null },
        type: { in: ['count', 'variance', 'verify'] },
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const zoneByUser = new Map(assignments.map((a) => [a.userId, a.zoneCode]))
  const countByUser = new Map<string, number>()
  const lastActiveByUser = new Map<string, Date>()
  for (const a of activities) {
    if (!a.userId) continue
    countByUser.set(a.userId, (countByUser.get(a.userId) ?? 0) + 1)
    if (!lastActiveByUser.has(a.userId)) lastActiveByUser.set(a.userId, a.createdAt)
  }

  const userIds = new Set([...zoneByUser.keys(), ...countByUser.keys()])
  const stats = Array.from(userIds).map((userId) => {
    const lastAt = lastActiveByUser.get(userId)
    let lastActive = '—'
    if (lastAt) {
      const diffMs = Date.now() - lastAt.getTime()
      if (diffMs < 60_000) lastActive = 'Just now'
      else if (diffMs < 3600_000) lastActive = `${Math.floor(diffMs / 60_000)}m ago`
      else if (diffMs < 86400_000) lastActive = `${Math.floor(diffMs / 3600_000)}h ago`
      else lastActive = lastAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    return {
      userId,
      zoneCode: zoneByUser.get(userId) ?? null,
      itemsCounted: countByUser.get(userId) ?? 0,
      lastActive,
    }
  })

  return NextResponse.json(stats)
}
