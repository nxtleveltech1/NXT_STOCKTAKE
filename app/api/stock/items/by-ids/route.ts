import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

const MAX_IDS = 50_000

export async function POST(request: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  let body: { ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ids = Array.isArray(body?.ids) ? body.ids : []
  if (ids.length === 0) {
    return NextResponse.json({ items: [] })
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Maximum ${MAX_IDS} IDs allowed` }, { status: 400 })
  }

  const items = await db.stockItem.findMany({
    where: {
      organizationId: orgId,
      id: { in: ids },
    },
    orderBy: [{ status: 'asc' }, { location: 'asc' }, { name: 'asc' }],
  })

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
  }))

  return NextResponse.json({ items: mapped })
}
