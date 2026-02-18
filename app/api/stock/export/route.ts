import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

const EXPORT_LIMIT = 50_000

const CSV_HEADERS = [
  'SKU',
  'Product Name',
  'Supplier',
  'Category',
  'Location',
  'Warehouse',
  'UOM',
  'Expected',
  'Counted',
  'Variance',
  'Status',
  'Counted By',
  'Last Counted',
]

function escapeCsv(val: unknown): string {
  if (val == null) return ''
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const items = await db.stockItem.findMany({
    where: { organizationId: orgId },
    orderBy: [{ status: 'asc' }, { location: 'asc' }, { name: 'asc' }],
    take: EXPORT_LIMIT,
  })

  const rows = items.map((r) =>
    [
      r.sku,
      r.name,
      r.supplier ?? '',
      r.category ?? '',
      r.location,
      r.warehouse ?? '',
      r.uom ?? '',
      r.expectedQty,
      r.countedQty ?? '',
      r.variance ?? '',
      r.status,
      r.lastCountedBy ?? '',
      r.lastCountedAt
        ? new Date(r.lastCountedAt).toISOString()
        : '',
    ].map(escapeCsv).join(',')
  )

  const csv = [CSV_HEADERS.join(','), ...rows].join('\n')
  const filename = `stock-progress-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
