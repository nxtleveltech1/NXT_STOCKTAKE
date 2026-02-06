import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const session = await db.stockSession.findFirst({
    orderBy: { startedAt: 'desc' },
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
      location: 'NXT Stock',
      totalItems: total,
      countedItems: counted,
      varianceItems: variance,
      verifiedItems: verified,
      teamMembers: 0,
    })
  }

  const [counted, variance, verified] = await Promise.all([
    db.stockItem.count({ where: { status: { in: ['counted', 'variance', 'verified'] } } }),
    db.stockItem.count({ where: { status: 'variance' } }),
    db.stockItem.count({ where: { status: 'verified' } }),
  ])

  return NextResponse.json({
    id: session.id,
    name: session.name,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    location: session.location ?? 'NXT Stock',
    totalItems: session.totalItems,
    countedItems: counted,
    varianceItems: variance,
    verifiedItems: verified,
    teamMembers: session.teamMembers,
  })
}
