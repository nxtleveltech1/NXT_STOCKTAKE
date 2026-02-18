import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

function displayName(firstName: string | null, lastName: string | null, userId: string): string {
  if (firstName && lastName) return `${firstName} ${lastName}`.trim()
  if (firstName) return firstName
  if (lastName) return lastName
  return userId ? `User ${userId.slice(-6)}` : 'Unknown'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId } = await auth()
  const { id: issueId } = await params

  const issue = await db.stockIssue.findUnique({ where: { id: issueId } })
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (orgId && issue.organizationId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!orgId && issue.organizationId != null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const comments = await db.stockIssueComment.findMany({
    where: { issueId },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      issueId: c.issueId,
      userId: c.userId,
      userName: c.userName,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  const user = await currentUser()
  const userName = user
    ? displayName(user.firstName, user.lastName, user.id)
    : (userId ? `User ${userId.slice(-6)}` : 'Unknown')

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: issueId } = await params
  const issue = await db.stockIssue.findUnique({ where: { id: issueId } })
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (orgId && issue.organizationId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!orgId && issue.organizationId != null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const commentBody = typeof body.body === 'string' ? body.body.trim() : ''
  if (!commentBody) return NextResponse.json({ error: 'Body is required' }, { status: 400 })

  const comment = await db.stockIssueComment.create({
    data: {
      issueId,
      userId,
      userName,
      body: commentBody,
    },
  })

  return NextResponse.json({
    id: comment.id,
    issueId: comment.issueId,
    userId: comment.userId,
    userName: comment.userName,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  })
}
