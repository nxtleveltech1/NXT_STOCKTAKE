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

  const rows = await db.stockItem.findMany({
    where,
    select: { id: true },
    orderBy: [{ status: 'asc' }, { location: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({ ids: rows.map((r) => r.id) })
}
