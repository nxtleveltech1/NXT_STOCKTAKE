import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { isAllowedLocation } from '@/lib/locations'

const MAX_ROWS = 5_000
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

const importRowSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Name is required'),
  location: z.string().min(1, 'Location is required'),
  expectedQty: z.number().min(0),
  countedQty: z.number().min(0).optional(),
  countedBy: z.string().optional(),
  countedAt: z.string().optional(),
  verified: z.boolean().optional(),
  barcode: z.string().optional(),
  uom: z.string().optional(),
  category: z.string().optional(),
  supplier: z.string().optional(),
  warehouse: z.string().optional(),
  serialNumber: z.string().optional(),
  owner: z.string().optional(),
})

type ImportRow = z.infer<typeof importRowSchema>

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  sku: 'sku',
  name: 'name',
  'product name': 'name',
  location: 'location',
  expected: 'expectedQty',
  'expected qty': 'expectedQty',
  counted: 'countedQty',
  'counted qty': 'countedQty',
  'counted by': 'countedBy',
  'counted at': 'countedAt',
  'last counted': 'countedAt',
  verified: 'verified',
  barcode: 'barcode',
  uom: 'uom',
  category: 'category',
  supplier: 'supplier',
  warehouse: 'warehouse',
  'serial number': 'serialNumber',
  owner: 'owner',
}

function trim(s: unknown): string {
  return String(s ?? '').trim()
}

function parseNumber(val: unknown): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  const n = parseFloat(String(val ?? '').replace(/,/g, ''))
  return Number.isNaN(n) ? 0 : n
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        current += c
      }
    } else if (c === ',') {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

function parseBoolean(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  const s = String(val ?? '').toLowerCase().trim()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y'
}

function parseDate(val: unknown): string | undefined {
  if (!val) return undefined
  const s = trim(val)
  if (!s) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function mapRow(raw: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const key = k.toLowerCase().trim()
    const field = COLUMN_MAP[key]
    if (field && v !== undefined && v !== null && String(v).trim() !== '') {
      if (field === 'expectedQty' || field === 'countedQty') {
        row[field] = parseNumber(v)
      } else if (field === 'verified') {
        row[field] = parseBoolean(v)
      } else if (field === 'countedAt') {
        const parsed = parseDate(v)
        if (parsed) row[field] = parsed
      } else {
        row[field] = trim(v)
      }
    }
  }
  // Aliases
  const rawLower = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k.toLowerCase().trim(), v])
  )
  if (!row.sku && rawLower['internal ref']) row.sku = trim(rawLower['internal ref'])
  if (!row.name && rawLower['product']) row.name = trim(rawLower['product'])
  if (!row.name && rawLower['product name']) row.name = trim(rawLower['product name'])
  return row
}

function parseXlsx(buffer: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  return rows.map((r) => mapRow(r))
}

function parseCsvToObjects(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]!).map((h) => h.trim())
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!)
    const row: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ''
    })
    rows.push(mapRow(row))
  }
  return rows
}

function toImportRow(raw: Record<string, unknown>): ImportRow | null {
  const sku = trim(raw.sku)
  const name = trim(raw.name)
  const location = trim(raw.location)
  const expectedQty = parseNumber(raw.expectedQty ?? raw.expected ?? 0)
  if (!sku || !name || !location) return null
  const countedQtyRaw = raw.countedQty
  const countedQty =
    countedQtyRaw !== undefined && countedQtyRaw !== null && String(countedQtyRaw).trim() !== ''
      ? parseNumber(countedQtyRaw)
      : undefined
  return {
    sku,
    name,
    location,
    expectedQty,
    countedQty: countedQty !== undefined ? countedQty : undefined,
    countedBy: trim(raw.countedBy) || undefined,
    countedAt: raw.countedAt ? String(raw.countedAt).trim() || undefined : undefined,
    verified: raw.verified !== undefined ? parseBoolean(raw.verified) : undefined,
    barcode: trim(raw.barcode) || undefined,
    uom: trim(raw.uom) || undefined,
    category: trim(raw.category) || undefined,
    supplier: trim(raw.supplier) || undefined,
    warehouse: trim(raw.warehouse) || undefined,
    serialNumber: trim(raw.serialNumber) || undefined,
    owner: trim(raw.owner) || undefined,
  }
}

export async function POST(request: Request) {
  const { orgId } = await auth()
  if (!orgId) return NextResponse.json({ error: 'Organization required' }, { status: 403 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    )
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
    return NextResponse.json(
      { error: 'Invalid file type. Use CSV or XLSX.' },
      { status: 400 }
    )
  }

  let rawRows: Record<string, unknown>[]
  try {
    if (ext === 'csv') {
      const text = await file.text()
      rawRows = parseCsvToObjects(text)
    } else {
      const buffer = await file.arrayBuffer()
      rawRows = parseXlsx(buffer)
    }
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to parse file', details: String(e) },
      { status: 400 }
    )
  }

  if (rawRows.length === 0) {
    return NextResponse.json(
      { error: 'No data rows found. Ensure file has a header row and at least one data row.' },
      { status: 400 }
    )
  }

  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows. Maximum is ${MAX_ROWS}.` },
      { status: 400 }
    )
  }

  const errors: { row: number; message: string }[] = []
  const validRows: ImportRow[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 2 // 1-based, +1 for header
    const row = toImportRow(rawRows[i]!)
    if (!row) {
      errors.push({ row: rowNum, message: 'SKU, Name, and Location are required' })
      continue
    }
    if (!isAllowedLocation(row.location)) {
      errors.push({
        row: rowNum,
        message: `Location "${row.location}" is not allowed. Use one of: NXT/NXT STOCK, NXT/NXT STOCK/Rental, NXT/NXT STOCK/Secondhand, NXT/NXT STOCK/Studio Rentals, NXT/NXT STOCK/Repairs, NXT/NXT DATA VAULT`,
      })
      continue
    }
    const parsed = importRowSchema.safeParse(row)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      errors.push({ row: rowNum, message: first?.message ?? 'Validation failed' })
      continue
    }
    validRows.push(parsed.data)
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', created: 0, updated: 0, failed: errors.length, errors },
      { status: 400 }
    )
  }

  const maxOdoo = await db.stockItem.findFirst({
    orderBy: { odooId: 'desc' },
    select: { odooId: true },
  })
  let nextOdooId = (maxOdoo?.odooId ?? 0) + 1

  let created = 0
  let updated = 0

  try {
    const activitySession = await db.stockSession.findFirst({
      orderBy: { startedAt: 'desc' },
      where: { organizationId: orgId },
      select: { id: true },
    })

    for (const data of validRows) {
      const hasCounted = typeof data.countedQty === 'number'
      const countedBy = data.countedBy?.trim() || 'Import'
      const countedAt = data.countedAt
        ? (() => {
            const d = new Date(data.countedAt)
            return Number.isNaN(d.getTime()) ? new Date() : d
          })()
        : new Date()

      const existing = hasCounted
        ? await db.stockItem.findFirst({
            where: {
              organizationId: orgId,
              sku: data.sku,
              location: data.location,
            },
            select: { id: true, expectedQty: true, status: true },
          })
        : null

      if (existing) {
        const variance = data.countedQty! - existing.expectedQty
        const status =
          variance === 0 ? 'counted' : data.verified ? 'verified' : 'variance'

        await db.stockItem.update({
          where: { id: existing.id },
          data: {
            countedQty: data.countedQty!,
            variance,
            status,
            lastCountedBy: countedBy,
            lastCountedAt: countedAt,
          },
        })
        updated++
      } else {
        const variance = hasCounted ? data.countedQty! - data.expectedQty : null
        const status = hasCounted
          ? data.verified && variance !== 0
            ? 'verified'
            : variance === 0
              ? 'counted'
              : 'variance'
          : 'pending'

        await db.stockItem.create({
          data: {
            organizationId: orgId,
            odooId: nextOdooId++,
            sku: data.sku,
            name: data.name,
            location: data.location,
            expectedQty: data.expectedQty,
            reservedQty: null,
            availableQty: null,
            countedQty: hasCounted ? data.countedQty! : null,
            variance: variance ?? null,
            status,
            lastCountedBy: hasCounted ? countedBy : null,
            lastCountedAt: hasCounted ? countedAt : null,
            barcode: data.barcode?.trim() || null,
            uom: data.uom?.trim() || null,
            category: data.category?.trim() || null,
            supplier: data.supplier?.trim() || null,
            warehouse: data.warehouse?.trim() || null,
            serialNumber: data.serialNumber?.trim() || null,
            owner: data.owner?.trim() || null,
          },
        })
        created++
      }
    }

    if (updated > 0) {
      await db.stockActivity.create({
        data: {
          organizationId: orgId,
          sessionId: activitySession?.id ?? undefined,
          type: 'count',
          message: `Bulk import: ${updated} item${updated !== 1 ? 's' : ''} updated with counts`,
          zone: undefined,
        },
      })
    }
  } catch (e) {
    console.error('Import error:', e)
    return NextResponse.json(
      {
        error: 'Failed to import',
        created,
        updated,
        failed: validRows.length - created - updated,
        errors: [] as { row: number; message: string }[],
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    created,
    updated,
    failed: 0,
    errors: [] as { row: number; message: string }[],
  })
}
