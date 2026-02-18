import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { NXT_STOCK_ORG_ID } from '@/lib/org'

function toSessionJson(session: {
  id: string
  name: string
  status: string
  startedAt: Date
  pausedAt: Date | null
  totalPausedSeconds: number
  location: string | null
  totalItems: number
  countedItems: number
  varianceItems: number
  verifiedItems: number
  teamMembers: number
}, counted: number, variance: number, verified: number) {
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    pausedAt: session.pausedAt?.toISOString() ?? null,
    totalPausedSeconds: session.totalPausedSeconds,
    location: session.location ?? 'NXT Stock',
    totalItems: session.totalItems,
    countedItems: counted,
    varianceItems: variance,
    verifiedItems: verified,
    teamMembers: session.teamMembers,
  }
}

export async function GET() {
  const session = await db.stockSession.findFirst({
    orderBy: { startedAt: 'desc' },
    where: { organizationId: NXT_STOCK_ORG_ID },
  })
  if (!session) {
    const total = await db.stockItem.count()
    const counted = await db.stockItem.count({
      where: { status: { in: ['counted', 'variance', 'verified'] } },
    })
    const variance = await db.stockItem.count({ where: { status: 'variance' } })
    const verified = await db.stockItem.count({ where: { status: 'verified' } })
    return NextResponse.json({
      id: 'default',
      name: 'Q1 Full Stock Take',
      status: 'live',
      startedAt: new Date().toISOString(),
      pausedAt: null,
      totalPausedSeconds: 0,
      location: 'NXT Stock',
      totalItems: total,
      countedItems: counted,
      varianceItems: variance,
      verifiedItems: verified,
      teamMembers: 0,
      isDefault: true,
    })
  }

  const [counted, variance, verified] = await Promise.all([
    db.stockItem.count({ where: { status: { in: ['counted', 'variance', 'verified'] } } }),
    db.stockItem.count({ where: { status: 'variance' } }),
    db.stockItem.count({ where: { status: 'verified' } }),
  ])

  return NextResponse.json({
    ...toSessionJson(
      { ...session, totalPausedSeconds: session.totalPausedSeconds ?? 0 },
      counted,
      variance,
      verified,
    ),
    isDefault: false,
  })
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = (typeof body.name === 'string' && body.name.trim()) ? body.name.trim() : 'Q1 Full Stock Take'

  const total = await db.stockItem.count()
  const session = await db.stockSession.create({
    data: {
      organizationId: NXT_STOCK_ORG_ID,
      name,
      status: 'live',
      location: 'NXT Stock',
      totalItems: total,
    },
  })

  const [counted, variance, verified] = await Promise.all([
    db.stockItem.count({ where: { status: { in: ['counted', 'variance', 'verified'] } } }),
    db.stockItem.count({ where: { status: 'variance' } }),
    db.stockItem.count({ where: { status: 'verified' } }),
  ])

  return NextResponse.json({
    ...toSessionJson(
      { ...session, totalPausedSeconds: session.totalPausedSeconds ?? 0 },
      counted,
      variance,
      verified,
    ),
    isDefault: false,
  })
}

export async function PATCH(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await db.stockSession.findFirst({
    orderBy: { startedAt: 'desc' },
    where: { organizationId: NXT_STOCK_ORG_ID },
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const status = body.status as string | undefined
  if (!['live', 'paused', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const now = new Date()
  const updateData: Record<string, unknown> = { status }

  if (status === 'paused') {
    updateData.pausedAt = now
  } else if (status === 'live') {
    const pausedAt = session.pausedAt
    const totalPaused = session.totalPausedSeconds ?? 0
    if (pausedAt) {
      const extraSeconds = Math.floor((now.getTime() - pausedAt.getTime()) / 1000)
      updateData.totalPausedSeconds = totalPaused + extraSeconds
    }
    updateData.pausedAt = null
  }

  const updated = await db.stockSession.update({
    where: { id: session.id },
    data: updateData as Parameters<typeof db.stockSession.update>[0]['data'],
  })

  const [counted, variance, verified] = await Promise.all([
    db.stockItem.count({ where: { status: { in: ['counted', 'variance', 'verified'] } } }),
    db.stockItem.count({ where: { status: 'variance' } }),
    db.stockItem.count({ where: { status: 'verified' } }),
  ])

  return NextResponse.json({
    ...toSessionJson(
      { ...updated, totalPausedSeconds: updated.totalPausedSeconds ?? 0 },
      counted,
      variance,
      verified,
    ),
    isDefault: false,
  })
}
