import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

export async function PATCH(request: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : []

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids array required and must not be empty" }, { status: 400 })
  }

  const zone = body.zone !== undefined
    ? (typeof body.zone === "string" ? body.zone.trim() || null : null)
    : undefined
  const status = ["open", "in_progress", "resolved", "closed"].includes(body.status)
    ? body.status
    : undefined
  const priority = ["low", "medium", "high", "critical"].includes(body.priority)
    ? body.priority
    : undefined
  const assigneeId =
    typeof body.assigneeId === "string" ? (body.assigneeId.trim() || null) : undefined
  const assigneeName =
    typeof body.assigneeName === "string" ? (body.assigneeName.trim() || null) : undefined

  const hasUpdate =
    zone !== undefined ||
    status !== undefined ||
    priority !== undefined ||
    assigneeId !== undefined

  if (!hasUpdate) {
    return NextResponse.json(
      { error: "At least one of zone, status, priority, assigneeId required" },
      { status: 400 }
    )
  }

  const issues = await db.stockIssue.findMany({
    where: {
      id: { in: ids },
      organizationId: orgId,
    },
  })

  const validIds = new Set(issues.map((i) => i.id))
  const invalidIds = ids.filter((id: string) => !validIds.has(id))

  if (validIds.size === 0) {
    return NextResponse.json({ error: "No valid issues found", updated: 0 }, { status: 404 })
  }

  const updateData: Parameters<typeof db.stockIssue.updateMany>[0]["data"] = {}
  if (zone !== undefined) updateData.zone = zone
  if (status !== undefined) {
    updateData.status = status
    if (status === "resolved" || status === "closed") {
      updateData.resolvedAt = new Date()
    }
  }
  if (priority !== undefined) updateData.priority = priority
  if (assigneeId !== undefined) updateData.assigneeId = assigneeId
  if (assigneeName !== undefined) updateData.assigneeName = assigneeName

  const result = await db.stockIssue.updateMany({
    where: {
      id: { in: Array.from(validIds) },
      organizationId: orgId,
    },
    data: updateData,
  })

  return NextResponse.json({
    updated: result.count,
    errors: invalidIds.length > 0 ? [`${invalidIds.length} id(s) not found or forbidden`] : undefined,
  })
}
