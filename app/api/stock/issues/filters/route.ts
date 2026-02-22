import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const baseWhere = { organizationId: orgId }

  const [zoneRows, reporterRows, assigneeRows] = await Promise.all([
    db.stockIssue.findMany({
      where: { ...baseWhere, zone: { not: null } },
      select: { zone: true },
      distinct: ['zone'],
      orderBy: { zone: 'asc' },
    }),
    db.stockIssue.findMany({
      where: baseWhere,
      select: { reporterId: true, reporterName: true },
      distinct: ['reporterId'],
      orderBy: { reporterName: 'asc' },
    }),
    db.stockIssue.findMany({
      where: { ...baseWhere, assigneeId: { not: null } },
      select: { assigneeId: true, assigneeName: true },
      distinct: ['assigneeId'],
      orderBy: { assigneeName: 'asc' },
    }),
  ])

  const zones = zoneRows
    .map((r) => r.zone)
    .filter((z): z is string => !!z && z.trim() !== '')

  const reporters = reporterRows.map((r) => ({
    id: r.reporterId,
    name: r.reporterName || `User ${r.reporterId.slice(-6)}`,
  }))

  const assignees = assigneeRows.map((r) => ({
    id: r.assigneeId!,
    name: r.assigneeName || `User ${r.assigneeId!.slice(-6)}`,
  }))

  return NextResponse.json({ zones, reporters, assignees })
}
