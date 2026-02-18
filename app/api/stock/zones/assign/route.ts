import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

async function createJoinActivity(
  orgId: string | null,
  userId: string,
  userName: string,
  zoneCode: string
) {
  const session = await db.stockSession.findFirst({
    orderBy: { startedAt: 'desc' },
    where: orgId ? { organizationId: orgId } : { organizationId: null },
  })
  await db.stockActivity.create({
    data: {
      organizationId: orgId ?? undefined,
      sessionId: session?.id ?? undefined,
      type: 'join',
      message: `joined zone ${zoneCode}`,
      userId,
      userName,
      zone: zoneCode,
    },
  })
}

export async function GET() {
  const { orgId } = await auth()
  const assignments = await db.zoneAssignment.findMany({
    where: orgId ? { organizationId: orgId } : { organizationId: null },
  })
  return NextResponse.json(
    assignments.map((a) => ({
      zoneCode: a.zoneCode,
      userId: a.userId,
    }))
  )
}

export async function PATCH(request: Request) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const assignments = body.assignments as Array<{ zoneCode: string; userId: string }> | undefined
  if (!Array.isArray(assignments)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const clerkClient = (await import('@clerk/nextjs/server')).clerkClient

  for (const { zoneCode, userId: assigneeId } of assignments) {
    if (!zoneCode || typeof zoneCode !== 'string') continue
    const targetUserId = typeof assigneeId === 'string' && assigneeId ? assigneeId : null

    const existing = await db.zoneAssignment.findFirst({
      where: {
        organizationId: orgId ?? null,
        zoneCode,
      },
    })

    if (targetUserId) {
      if (existing) {
        if (existing.userId !== targetUserId) {
          await db.zoneAssignment.update({
            where: { id: existing.id },
            data: { userId: targetUserId },
          })
          const assignee = await clerkClient.users.getUser(targetUserId).catch(() => null)
          const assigneeName = assignee
            ? [assignee.firstName, assignee.lastName].filter(Boolean).join(' ').trim() || `User ${targetUserId.slice(-6)}`
            : `User ${targetUserId.slice(-6)}`
          await createJoinActivity(orgId, targetUserId, assigneeName, zoneCode)
        }
      } else {
        await db.zoneAssignment.create({
          data: {
            organizationId: orgId ?? null,
            zoneCode,
            userId: targetUserId,
          },
        })
        const assignee = await clerkClient.users.getUser(targetUserId).catch(() => null)
        const assigneeName = assignee
          ? [assignee.firstName, assignee.lastName].filter(Boolean).join(' ').trim() || `User ${targetUserId.slice(-6)}`
          : `User ${targetUserId.slice(-6)}`
        await createJoinActivity(orgId, targetUserId, assigneeName, zoneCode)
      }
    } else if (existing) {
      await db.zoneAssignment.delete({ where: { id: existing.id } })
    }
  }

  const updated = await db.zoneAssignment.findMany({
    where: orgId ? { organizationId: orgId } : { organizationId: null },
  })
  return NextResponse.json(
    updated.map((a) => ({ zoneCode: a.zoneCode, userId: a.userId }))
  )
}
