import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const createItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  location: z.string().min(1, 'Location is required'),
  expectedQty: z.number().min(0).default(0),
  barcode: z.string().optional(),
  uom: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
  warehouse: z.string().optional(),
})

export async function POST(request: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  const maxOdoo = await db.stockItem.findFirst({
    orderBy: { odooId: 'desc' },
    select: { odooId: true },
  })
  const nextOdooId = (maxOdoo?.odooId ?? 0) + 1

  const item = await db.stockItem.create({
    data: {
      organizationId: orgId,
      odooId: nextOdooId,
      sku: data.sku.trim(),
      name: data.name.trim(),
      location: data.location,
      expectedQty: data.expectedQty,
      reservedQty: null,
      availableQty: null,
      countedQty: null,
      variance: null,
      status: 'pending',
      barcode: data.barcode?.trim() || null,
      uom: data.uom?.trim() || null,
      category: data.category?.trim() || null,
      supplier: data.supplier?.trim() || null,
      warehouse: data.warehouse?.trim() || null,
    },
  })

  return NextResponse.json({
    id: item.id,
    odooId: item.odooId,
    sku: item.sku,
    name: item.name,
    category: item.category ?? '',
    location: item.location,
    warehouse: item.warehouse ?? '',
    expectedQty: item.expectedQty,
    reservedQty: item.reservedQty ?? 0,
    availableQty: item.availableQty ?? 0,
    countedQty: item.countedQty,
    variance: item.variance,
    status: item.status,
    lastCountedBy: item.lastCountedBy,
    lastCountedAt: item.lastCountedAt
      ? new Date(item.lastCountedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
    barcode: item.barcode ?? null,
    uom: item.uom ?? null,
    serialNumber: item.serialNumber ?? null,
    owner: item.owner ?? null,
    supplier: item.supplier ?? null,
    supplierId: item.supplierId ?? null,
    listPrice: item.listPrice ?? null,
    costPrice: item.costPrice ?? null,
  })
}

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
