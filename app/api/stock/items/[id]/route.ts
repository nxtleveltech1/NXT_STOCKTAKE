import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { ALLOWED_LOCATIONS } from '@/lib/locations'

function displayName(firstName: string | null, lastName: string | null, userId: string): string {
  if (firstName && lastName) return `${firstName} ${lastName}`.trim()
  if (firstName) return firstName
  if (lastName) return lastName
  return userId ? `User ${userId.slice(-6)}` : 'Unknown'
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  const user = await currentUser()
  const userName = user
    ? displayName(user.firstName, user.lastName, user.id)
    : (userId ? `User ${userId.slice(-6)}` : 'Unknown')

  const { id } = await params
  const body = await _request.json()
  const countedQty =
    typeof body.countedQty === 'number' ? body.countedQty : null
  const verified = body.verified === true
  const item = await db.stockItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (item.organizationId != null && item.organizationId !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateData: Parameters<typeof db.stockItem.update>[0]['data'] = {}

  // Product fields (optional)
  if (typeof body.sku === 'string' && body.sku.trim())
    updateData.sku = body.sku.trim()
  if (typeof body.name === 'string' && body.name.trim())
    updateData.name = body.name.trim()
  if (typeof body.barcode === 'string')
    updateData.barcode = body.barcode.trim() || null
  if (typeof body.uom === 'string') updateData.uom = body.uom.trim() || null
  if (typeof body.location === 'string' && body.location.trim()) {
    const loc = body.location.trim()
    const inCanonical = (ALLOWED_LOCATIONS as readonly string[]).includes(loc)
    const inDb =
      !inCanonical &&
      (await db.stockItem.findFirst({
        where: { organizationId: orgId, location: loc },
        select: { id: true },
      }))
    if (inCanonical || inDb) updateData.location = loc
  }
  if (typeof body.category === 'string')
    updateData.category = body.category.trim() || null
  if (typeof body.warehouse === 'string')
    updateData.warehouse = body.warehouse.trim() || null
  if (typeof body.serialNumber === 'string')
    updateData.serialNumber = body.serialNumber.trim() || null
  if (typeof body.owner === 'string')
    updateData.owner = body.owner.trim() || null
  if (typeof body.supplier === 'string')
    updateData.supplier = body.supplier.trim() || null

  if (Object.keys(updateData).length === 0 && countedQty === null && !verified)
    return NextResponse.json(
      { error: 'At least one field (countedQty, verified, sku, name, etc.) required' },
      { status: 400 }
    )

  if (verified) {
    if (item.status !== 'variance') {
      return NextResponse.json(
        { error: 'Only variance items can be verified' },
        { status: 400 }
      )
    }
    updateData.status = 'verified'
    const activitySession = await db.stockSession.findFirst({
      orderBy: { startedAt: 'desc' },
      where: { organizationId: orgId },
    })
    await db.stockActivity.create({
      data: {
        organizationId: orgId,
        sessionId: activitySession?.id ?? undefined,
        type: 'verify',
        message: `verified variance on ${item.name}`,
        userId: userId ?? undefined,
        userName,
        zone: item.location || undefined,
        itemId: id,
      },
    })
  }

  if (countedQty !== null) {
    const variance = countedQty - item.expectedQty
    const status = variance === 0 ? 'counted' : 'variance'
    updateData.countedQty = countedQty
    updateData.variance = variance
    updateData.status = status
    updateData.lastCountedBy = userName
    updateData.lastCountedAt = new Date()

    const activitySession = await db.stockSession.findFirst({
      orderBy: { startedAt: 'desc' },
      where: orgId ? { organizationId: orgId } : undefined,
    })
    const activityType = variance === 0 ? 'count' : 'variance'
    const activityMessage =
      variance === 0
        ? `counted ${countedQty} for ${item.name}`
        : `flagged variance on ${item.name} (${variance > 0 ? '+' : ''}${variance})`
    await db.stockActivity.create({
      data: {
        organizationId: orgId ?? undefined,
        sessionId: activitySession?.id ?? undefined,
        type: activityType,
        message: activityMessage,
        userId: userId ?? undefined,
        userName,
        zone: item.location || undefined,
        itemId: id,
      },
    })
  }

  const updated = await db.stockItem.update({
    where: { id },
    data: updateData,
  })

  // zone_complete: when a zone reaches 100% counted
  if (updated.location && (countedQty !== null || verified)) {
    const [total, counted] = await Promise.all([
      db.stockItem.count({
        where: { organizationId: orgId, location: updated.location },
      }),
      db.stockItem.count({
        where: {
          organizationId: orgId,
          location: updated.location,
          status: { in: ['counted', 'variance', 'verified'] },
        },
      }),
    ])
    if (total > 0 && counted >= total) {
      const activitySession = await db.stockSession.findFirst({
        orderBy: { startedAt: 'desc' },
        where: { organizationId: orgId },
      })
      const existing = await db.stockActivity.findFirst({
        where: {
          organizationId: orgId,
          sessionId: activitySession?.id ?? undefined,
          type: 'zone_complete',
          zone: updated.location,
        },
      })
      if (!existing) {
        await db.stockActivity.create({
          data: {
            organizationId: orgId ?? undefined,
            sessionId: activitySession?.id ?? undefined,
            type: 'zone_complete',
            message: `completed zone ${updated.location}`,
            userId: userId ?? undefined,
            userName,
            zone: updated.location,
          },
        })
      }
    }
  }

  return NextResponse.json({
    id: updated.id,
    odooId: updated.odooId,
    sku: updated.sku,
    name: updated.name,
    category: updated.category ?? '',
    location: updated.location,
    warehouse: updated.warehouse ?? '',
    expectedQty: updated.expectedQty,
    reservedQty: updated.reservedQty ?? 0,
    availableQty: updated.availableQty ?? 0,
    countedQty: updated.countedQty,
    variance: updated.variance,
    status: updated.status,
    lastCountedBy: updated.lastCountedBy,
    lastCountedAt: updated.lastCountedAt
      ? new Date(updated.lastCountedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
    barcode: updated.barcode ?? null,
    uom: updated.uom ?? null,
    serialNumber: updated.serialNumber ?? null,
    owner: updated.owner ?? null,
    supplier: updated.supplier ?? null,
    supplierId: updated.supplierId ?? null,
    listPrice: updated.listPrice ?? null,
    costPrice: updated.costPrice ?? null,
  })
}
