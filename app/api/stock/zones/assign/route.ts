import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

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
        await db.zoneAssignment.update({
          where: { id: existing.id },
          data: { userId: targetUserId },
        })
      } else {
        await db.zoneAssignment.create({
          data: {
            organizationId: orgId ?? null,
            zoneCode,
            userId: targetUserId,
          },
        })
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
