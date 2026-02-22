import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const location = searchParams.get('location')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const uom = searchParams.get('uom')
  const warehouse = searchParams.get('warehouse')
  const supplier = searchParams.get('supplier')
  const countedBy = searchParams.get('countedBy')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
  const skip = (page - 1) * limit

  type WhereInput = NonNullable<Parameters<typeof db.stockItem.findMany>[0]>['where']
  const where: WhereInput = { organizationId: orgId }

  if (location && location !== 'All Zones') {
    where.location = location
  }
  if (status && status !== 'all') {
    where.status = status
  }
  if (category && category !== 'all') {
    where.category = category
  }
  if (uom && uom !== 'all') {
    where.uom = uom
  }
  if (warehouse && warehouse !== 'all') {
    where.warehouse = warehouse
  }
  if (supplier && supplier !== 'all') {
    where.supplier = supplier
  }
  if (countedBy && countedBy !== 'all') {
    where.lastCountedBy = countedBy
  }
  if (search?.trim()) {
    const s = search.trim()
    const orConditions: NonNullable<WhereInput>['OR'] = [
      { sku: { contains: s, mode: 'insensitive' } },
      { name: { contains: s, mode: 'insensitive' } },
    ]
    if (s.length >= 2) {
      // Exact barcode match first when search looks like a barcode (scans are often exact)
      const isBarcodeLike =
        (/^\d{8,13}$/.test(s) || (s.length >= 4 && s.length <= 80 && /^[\dA-Za-z\-]+$/.test(s)))
      if (isBarcodeLike) {
        orConditions.unshift({ barcode: { equals: s } })
      }
      orConditions.push(
        { barcode: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
        { serialNumber: { contains: s, mode: 'insensitive' } },
        { supplier: { contains: s, mode: 'insensitive' } },
      )
    }
    where.OR = orConditions
  }

  // Aggregate counts for summary cards (unfiltered totals)
  const [items, total, statusCounts] = await Promise.all([
    db.stockItem.findMany({
      where,
      orderBy: [{ status: 'asc' }, { location: 'asc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
    db.stockItem.count({ where }),
    db.stockItem.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
  ])

  const summary = {
    total: statusCounts.reduce((sum, s) => sum + s._count.id, 0),
    pending: statusCounts.find((s) => s.status === 'pending')?._count.id ?? 0,
    counted: statusCounts.find((s) => s.status === 'counted')?._count.id ?? 0,
    variance: statusCounts.find((s) => s.status === 'variance')?._count.id ?? 0,
    verified: statusCounts.find((s) => s.status === 'verified')?._count.id ?? 0,
  }

  const searchTrimmed = search?.trim()
  const mapped = items.map((r) => ({
    id: r.id,
    odooId: r.odooId,
    sku: r.sku,
    name: r.name,
    category: r.category ?? '',
    location: r.location,
    warehouse: r.warehouse ?? '',
    expectedQty: r.expectedQty,
    reservedQty: r.reservedQty ?? 0,
    availableQty: r.availableQty ?? 0,
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
    serialNumber: r.serialNumber ?? null,
    owner: r.owner ?? null,
    supplier: r.supplier ?? null,
    supplierId: r.supplierId ?? null,
    listPrice: r.listPrice ?? null,
    costPrice: r.costPrice ?? null,
    exactBarcodeMatch:
      !!searchTrimmed && (r.barcode?.trim() ?? '').toLowerCase() === searchTrimmed.toLowerCase(),
  }))

  // Sort exact barcode matches first
  if (searchTrimmed) {
    mapped.sort((a, b) => {
      const aExact = (a as { exactBarcodeMatch?: boolean }).exactBarcodeMatch ? 0 : 1
      const bExact = (b as { exactBarcodeMatch?: boolean }).exactBarcodeMatch ? 0 : 1
      return aExact - bExact
    })
  }

  return NextResponse.json({ items: mapped, total, filteredTotal: total, summary })
}
