import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

function displayName(firstName: string | null, lastName: string | null, userId: string): string {
  if (firstName && lastName) return `${firstName} ${lastName}`.trim()
  if (firstName) return firstName
  if (lastName) return lastName
  return userId ? `User ${userId.slice(-6)}` : 'Unknown'
}

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

export async function GET(request: Request) {
  const { orgId } = await auth()
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId') ?? undefined
  const status = searchParams.get('status') ?? undefined
  const priority = searchParams.get('priority') ?? undefined
  const classification = searchParams.get('classification') ?? undefined
  const search = searchParams.get('search')?.trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))

  type WhereInput = { organizationId?: string | null; sessionId?: string; status?: string; priority?: string; classification?: string; OR?: Array<{ title?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }> }
  const where: WhereInput = orgId ? { organizationId: orgId } : { organizationId: null }
  if (sessionId) where.sessionId = sessionId
  if (status) where.status = status
  if (priority) where.priority = priority
  if (classification) where.classification = classification
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [issues, total] = await Promise.all([
    db.stockIssue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { _count: { select: { stockIssueComments: true } } },
    }),
    db.stockIssue.count({ where }),
  ])

  return NextResponse.json({
    issues: issues.map((i) => ({
      ...toIssueJson(i),
      commentCount: i._count.stockIssueComments,
    })),
    total,
  })
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth()
  const user = await currentUser()
  const userName = user
    ? displayName(user.firstName, user.lastName, user.id)
    : (userId ? `User ${userId.slice(-6)}` : 'Unknown')

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const priority = ['low', 'medium', 'high', 'critical'].includes(body.priority)
    ? body.priority
    : 'medium'
  const description = typeof body.description === 'string' ? body.description.trim() || null : null
  const classification = typeof body.classification === 'string' ? body.classification.trim() || null : null
  const category = typeof body.category === 'string' ? body.category.trim() || null : null
  const zone = typeof body.zone === 'string' ? body.zone.trim() || null : null
  const itemId = typeof body.itemId === 'string' ? body.itemId.trim() || null : null
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() || null : null

  const issue = await db.stockIssue.create({
    data: {
      organizationId: orgId ?? null,
      sessionId,
      title,
      description,
      priority,
      classification,
      category,
      zone,
      itemId,
      reporterId: userId,
      reporterName: userName,
    },
  })

  return NextResponse.json(toIssueJson(issue))
}
