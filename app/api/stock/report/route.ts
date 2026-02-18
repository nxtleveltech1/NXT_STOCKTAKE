import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [session, zones, items] = await Promise.all([
    db.stockSession.findFirst({
      orderBy: { startedAt: 'desc' },
    }),
    db.stockItem.groupBy({
      by: ['location'],
      where: { location: { not: '' } },
      _count: { id: true },
      _sum: { expectedQty: true },
    }),
    db.stockItem.findMany({
      where: { status: { in: ['counted', 'variance', 'verified'] } },
      orderBy: [{ status: 'asc' }, { location: 'asc' }],
      take: 500,
    }),
  ])

  const total = await db.stockItem.count()
  const counted = await db.stockItem.count({
    where: { status: { in: ['counted', 'variance', 'verified'] } },
  })
  const variance = await db.stockItem.count({ where: { status: 'variance' } })
  const verified = await db.stockItem.count({ where: { status: 'verified' } })

  const zoneRows = zones.map((z) => {
    const totalItems = (z._sum.expectedQty ?? 0) || z._count.id
    return `<tr><td>${escapeHtml(z.location)}</td><td>${totalItems}</td></tr>`
  }).join('')

  const itemRows = items.slice(0, 100).map((i) =>
    `<tr>
      <td>${escapeHtml(i.sku)}</td>
      <td>${escapeHtml(i.name ?? '')}</td>
      <td>${escapeHtml(i.location)}</td>
      <td>${i.expectedQty}</td>
      <td>${i.countedQty ?? '—'}</td>
      <td>${i.variance ?? '—'}</td>
      <td>${escapeHtml(i.status)}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Stock Take Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    h1 { font-size: 1.5rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .summary { display: flex; gap: 2rem; margin: 1rem 0; }
    .stat { padding: 0.5rem 1rem; background: #f0f0f0; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Stock Take Report</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  <p>Session: ${escapeHtml(session?.name ?? 'Default')} (${escapeHtml(session?.status ?? 'live')})</p>
  <div class="summary">
    <span class="stat">Total: ${total}</span>
    <span class="stat">Counted: ${counted}</span>
    <span class="stat">Variances: ${variance}</span>
    <span class="stat">Verified: ${verified}</span>
  </div>
  <h2>Zone Summary</h2>
  <table>
    <thead><tr><th>Zone</th><th>Items</th></tr></thead>
    <tbody>${zoneRows}</tbody>
  </table>
  <h2>Recent Counts (sample)</h2>
  <table>
    <thead><tr><th>SKU</th><th>Name</th><th>Location</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Status</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline; filename="stock-report.html"',
    },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
