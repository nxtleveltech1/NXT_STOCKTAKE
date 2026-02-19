import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const issueWhere = { organizationId: orgId }
  const itemWhere = { organizationId: orgId }

  const [issues, varianceItems] = await Promise.all([
    db.stockIssue.findMany({
      where: issueWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        stockIssueComments: { orderBy: { createdAt: 'asc' } },
      },
    }),
    db.stockItem.findMany({
      where: { ...itemWhere, status: 'variance' },
      orderBy: [{ location: 'asc' }, { name: 'asc' }],
    }),
  ])

  const itemIds = [...new Set(issues.map((i) => i.itemId).filter(Boolean))] as string[]
  const linkedItems =
    itemIds.length > 0
      ? await db.stockItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, sku: true, name: true, location: true },
        })
      : []
  const itemMap = new Map(linkedItems.map((i) => [i.id, i]))

  const issueHeaders = [
    'ID',
    'Title',
    'Description',
    'Status',
    'Priority',
    'Category',
    'Zone',
    'Linked Item SKU',
    'Linked Item Name',
    'Linked Item Location',
    'Reporter',
    'Assignee',
    'Created',
    'Updated',
    'Resolved',
    'Comment Count',
    'Comments (Full Detail)',
  ]

  const issueRows = issues.map((i) => {
    const linked = i.itemId ? itemMap.get(i.itemId) : null
    const commentsText = i.stockIssueComments
      .map(
        (c) =>
          `[${c.createdAt.toISOString()}] ${c.userName}: ${c.body.replace(/\r\n|\r|\n/g, ' ')}`
      )
      .join('\n\n')
    return [
      i.id,
      i.title,
      i.description ?? '',
      i.status,
      i.priority,
      i.category ?? '',
      i.zone ?? '',
      linked?.sku ?? '',
      linked?.name ?? '',
      linked?.location ?? '',
      i.reporterName,
      i.assigneeName ?? '',
      i.createdAt.toISOString(),
      i.updatedAt.toISOString(),
      i.resolvedAt?.toISOString() ?? '',
      i.stockIssueComments.length,
      commentsText,
    ]
  })

  const varianceHeaders = [
    'ID',
    'SKU',
    'Product Name',
    'Category',
    'Location',
    'Warehouse',
    'Supplier',
    'UOM',
    'Barcode',
    'Serial Number',
    'Expected',
    'Counted',
    'Variance',
    'Status',
    'Last Counted By',
    'Last Counted At',
    'Odoo ID',
    'Reserved',
    'Available',
    'List Price',
    'Cost Price',
  ]

  const varianceRows = varianceItems.map((r) => [
    r.id,
    r.sku,
    r.name,
    r.category ?? '',
    r.location,
    r.warehouse ?? '',
    r.supplier ?? '',
    r.uom ?? '',
    r.barcode ?? '',
    r.serialNumber ?? '',
    r.expectedQty,
    r.countedQty ?? '',
    r.variance ?? '',
    r.status,
    r.lastCountedBy ?? '',
    r.lastCountedAt ? r.lastCountedAt.toISOString() : '',
    r.odooId,
    r.reservedQty ?? '',
    r.availableQty ?? '',
    r.listPrice ?? '',
    r.costPrice ?? '',
  ])

  const wb = XLSX.utils.book_new()
  const wsIssues = XLSX.utils.aoa_to_sheet([issueHeaders, ...issueRows])
  const wsVariances = XLSX.utils.aoa_to_sheet([varianceHeaders, ...varianceRows])

  XLSX.utils.book_append_sheet(wb, wsIssues, 'Issues')
  XLSX.utils.book_append_sheet(wb, wsVariances, 'Variances')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `issues-and-variances-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
