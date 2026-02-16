import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ALLOWED_LOCATIONS = ['NXT/NXT STOCK', 'NXT/NXT STOCK/Rental']

export async function GET() {
  const zones = await db.stockItem.groupBy({
    by: ['location'],
    where: {
      location: { in: ALLOWED_LOCATIONS },
    },
    _count: { id: true },
    _sum: { expectedQty: true },
  })

  const withStatus = await Promise.all(
    zones.map(async (z) => {
      const [counted, variances] = await Promise.all([
        db.stockItem.count({
          where: {
            location: z.location,
            status: { in: ['counted', 'variance', 'verified'] },
          },
        }),
        db.stockItem.count({
          where: { location: z.location, status: 'variance' },
        }),
      ])
      const total = z._count.id
      const totalQty = z._sum.expectedQty ?? 0
      return {
        name: z.location.split('/').pop() ?? z.location,
        code: z.location.slice(0, 1).toUpperCase(),
        totalItems: totalQty > 0 ? totalQty : total,
        countedItems: counted,
        variances,
        assignee: '',
      }
    })
  )

  return NextResponse.json(withStatus.sort((a, b) => a.name.localeCompare(b.name)))
}
