import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { ALLOWED_LOCATIONS } from '@/lib/locations'

export async function GET() {
  const { orgId } = await auth()
  const assignments = await db.zoneAssignment.findMany({
    where: orgId ? { organizationId: orgId } : { organizationId: null },
  })
  const assigneeByZone = new Map(assignments.map((a) => [a.zoneCode, a.userId]))

  const grouped = await db.stockItem.groupBy({
    by: ['location'],
    where: { location: { not: '' } },
    _count: { id: true },
    _sum: { expectedQty: true },
  })

  const groupMap = new Map(grouped.map((g) => [g.location, g]))
  const fromDb = grouped.map((g) => g.location)
  const canonicalSet = new Set(ALLOWED_LOCATIONS)
  const extra = fromDb.filter((l) => !canonicalSet.has(l)).sort()
  const zoneLocations = [...ALLOWED_LOCATIONS, ...extra]

  const withStatus = await Promise.all(
    zoneLocations.map(async (loc) => {
      const g = groupMap.get(loc)
      const total = g?._count.id ?? 0
      const totalQty = g?._sum.expectedQty ?? 0

      const [counted, variances] = await Promise.all([
        db.stockItem.count({
          where: {
            location: loc,
            status: { in: ['counted', 'variance', 'verified'] },
          },
        }),
        db.stockItem.count({
          where: { location: loc, status: 'variance' },
        }),
      ])

      const assigneeId = assigneeByZone.get(loc)
      return {
        zoneCode: loc,
        name: loc.split('/').pop() ?? loc,
        code: loc.split('/').pop()?.slice(0, 1).toUpperCase() ?? 'Z',
        totalItems: totalQty > 0 ? totalQty : total,
        countedItems: counted,
        variances,
        assignee: assigneeId ?? '',
        assigneeId: assigneeId ?? null,
      }
    })
  )

  return NextResponse.json(withStatus)
}
