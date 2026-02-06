import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const location = searchParams.get('location')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
  const skip = (page - 1) * limit

  const where: Parameters<typeof db.stockItem.findMany>[0]['where'] = {}
  if (location && location !== 'All Zones') {
    where.location = location
  }
  if (status && status !== 'all') {
    where.status = status
  }
  if (search?.trim()) {
    const s = search.trim()
    const orConditions: NonNullable<Parameters<typeof db.stockItem.findMany>[0]['where']>['OR'] = [
      { sku: { contains: s, mode: 'insensitive' } },
      { name: { contains: s, mode: 'insensitive' } },
    ]
    if (s.length >= 2) {
      orConditions.push({ barcode: { contains: s, mode: 'insensitive' } })
    }
    where.OR = orConditions
  }

  const [items, total] = await Promise.all([
    db.stockItem.findMany({
      where,
      orderBy: [{ status: 'asc' }, { location: 'asc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
    db.stockItem.count({ where }),
  ])

  const mapped = items.map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    category: r.category ?? '',
    location: r.location,
    expectedQty: r.expectedQty,
    countedQty: r.countedQty,
    variance: r.variance,
    status: r.status as 'pending' | 'counted' | 'variance' | 'verified',
    lastCountedBy: r.lastCountedBy,
    lastCountedAt: r.lastCountedAt
      ? new Date(r.lastCountedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
    barcode: r.barcode ?? null,
    uom: r.uom ?? null,
  }))

  return NextResponse.json({ items: mapped, total })
}
