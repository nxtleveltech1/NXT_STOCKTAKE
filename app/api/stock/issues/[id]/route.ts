import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

function toIssueJson(issue: {
  id: string
  organizationId: string | null
  sessionId: string | null
  title: string
  description: string | null
  status: string
  priority: string
  classification: string | null
  category: string | null
  zone: string | null
  itemId: string | null
  reporterId: string
  reporterName: string
  assigneeId: string | null
  assigneeName: string | null
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
}) {
  return {
    id: issue.id,
    organizationId: issue.organizationId,
    sessionId: issue.sessionId,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    classification: issue.classification,
    category: issue.category,
    zone: issue.zone,
    itemId: issue.itemId,
    reporterId: issue.reporterId,
    reporterName: issue.reporterName,
    assigneeId: issue.assigneeId,
    assigneeName: issue.assigneeName,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  const { id } = await params

  const issue = await db.stockIssue.findUnique({ where: { id } })
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (orgId && issue.organizationId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!orgId && issue.organizationId != null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const commentCount = await db.stockIssueComment.count({ where: { issueId: id } })

  return NextResponse.json({
    ...toIssueJson(issue),
    commentCount,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const issue = await db.stockIssue.findUnique({ where: { id } })
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (issue.organizationId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const updateData: Parameters<typeof db.stockIssue.update>[0]['data'] = {}

  const status = body.status
  if (['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    updateData.status = status
    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date()
    }
  }

  if (['low', 'medium', 'high', 'critical'].includes(body.priority)) {
    updateData.priority = body.priority
  }
  if (typeof body.assigneeId === 'string') {
    updateData.assigneeId = body.assigneeId.trim() || null
    updateData.assigneeName = typeof body.assigneeName === 'string' ? body.assigneeName.trim() || null : null
  }
  if (body.classification !== undefined) {
    updateData.classification = typeof body.classification === 'string' ? body.classification.trim() || null : null
  }
  if (body.zone !== undefined) {
    updateData.zone = typeof body.zone === 'string' ? body.zone.trim() || null : null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(toIssueJson(issue))
  }

  const updated = await db.stockIssue.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json(toIssueJson(updated))
}
