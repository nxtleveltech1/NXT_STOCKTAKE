import { NextResponse } from "next/server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { ALLOWED_LOCATIONS } from "@/lib/locations"

function displayName(
  firstName: string | null,
  lastName: string | null,
  userId: string
): string {
  if (firstName && lastName) return `${firstName} ${lastName}`.trim()
  if (firstName) return firstName
  if (lastName) return lastName
  return userId ? `User ${userId.slice(-6)}` : "Unknown"
}

export async function PATCH(request: Request) {
  const { userId, orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: "Organization required" }, { status: 403 })

  const user = await currentUser()
  const userName = user
    ? displayName(user.firstName, user.lastName, user.id)
    : userId
      ? `User ${userId.slice(-6)}`
      : "Unknown"

  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : []
  const location =
    typeof body.location === "string" && body.location.trim() ? body.location.trim() : undefined
  const verified = body.verified === true

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids array required and must not be empty" }, { status: 400 })
  }

  if (!location && !verified) {
    return NextResponse.json(
      { error: "At least one of location or verified required" },
      { status: 400 }
    )
  }

  // Fetch items and filter by org
  const items = await db.stockItem.findMany({
    where: {
      id: { in: ids },
      organizationId: orgId,
    },
  })

  const validIds = new Set(items.map((i) => i.id))
  const invalidIds = ids.filter((id: string) => !validIds.has(id))

  if (validIds.size === 0) {
    return NextResponse.json({ error: "No valid items found", updated: 0 }, { status: 404 })
  }

  // Validate location if provided
  let validatedLocation: string | undefined
  if (location) {
    const inCanonical = (ALLOWED_LOCATIONS as readonly string[]).includes(location)
    const inDb =
      !inCanonical &&
      (await db.stockItem.findFirst({
        where: { organizationId: orgId, location },
        select: { id: true },
      }))
    if (inCanonical || inDb) {
      validatedLocation = location
    } else {
      return NextResponse.json(
        { error: `Invalid location: ${location}` },
        { status: 400 }
      )
    }
  }

  const activitySession = await db.stockSession.findFirst({
    orderBy: { startedAt: "desc" },
    where: { organizationId: orgId },
  })

  let updated = 0

  for (const item of items) {
    const updateData: Parameters<typeof db.stockItem.update>[0]["data"] = {}

    if (validatedLocation) {
      updateData.location = validatedLocation
    }

    if (verified) {
      if (item.status !== "variance") continue
      updateData.status = "verified"
      await db.stockActivity.create({
        data: {
          organizationId: orgId,
          sessionId: activitySession?.id ?? undefined,
          type: "verify",
          message: `verified variance on ${item.name}`,
          userId: userId ?? undefined,
          userName,
          zone: item.location || undefined,
          itemId: item.id,
        },
      })
    }

    if (Object.keys(updateData).length === 0) continue

    await db.stockItem.update({
      where: { id: item.id },
      data: updateData,
    })
    updated++
  }

  return NextResponse.json({
    updated,
    errors: invalidIds.length > 0 ? [`${invalidIds.length} id(s) not found or forbidden`] : undefined,
  })
}
