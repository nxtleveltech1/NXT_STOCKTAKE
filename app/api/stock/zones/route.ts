import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ALLOWED_LOCATIONS } from '@/lib/locations'

export async function GET() {
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

      return {
        name: loc.split('/').pop() ?? loc,
        code: loc.split('/').pop()?.slice(0, 1).toUpperCase() ?? 'Z',
        totalItems: totalQty > 0 ? totalQty : total,
        countedItems: counted,
        variances,
        assignee: '',
      }
    })
  )

  return NextResponse.json(withStatus)
}
