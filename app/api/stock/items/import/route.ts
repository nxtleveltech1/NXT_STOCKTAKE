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

function mapRow(raw: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const key = k.toLowerCase().trim()
    const field = COLUMN_MAP[key]
    if (field && v !== undefined && v !== null && String(v).trim() !== '') {
      if (field === 'expectedQty') {
        row[field] = parseNumber(v)
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
  return {
    sku,
    name,
    location,
    expectedQty,
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
      { error: 'Validation failed', created: 0, failed: errors.length, errors },
      { status: 400 }
    )
  }

  const maxOdoo = await db.stockItem.findFirst({
    orderBy: { odooId: 'desc' },
    select: { odooId: true },
  })
  let nextOdooId = (maxOdoo?.odooId ?? 0) + 1

  try {
    for (const data of validRows) {
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
          countedQty: null,
          variance: null,
          status: 'pending',
          barcode: data.barcode?.trim() || null,
          uom: data.uom?.trim() || null,
          category: data.category?.trim() || null,
          supplier: data.supplier?.trim() || null,
          warehouse: data.warehouse?.trim() || null,
          serialNumber: data.serialNumber?.trim() || null,
          owner: data.owner?.trim() || null,
        },
      })
    }
  } catch (e) {
    console.error('Import create error:', e)
    return NextResponse.json(
      { error: 'Failed to create products', created: 0, failed: validRows.length, errors: [] },
      { status: 500 }
    )
  }

  return NextResponse.json({
    created: validRows.length,
    failed: 0,
    errors: [] as { row: number; message: string }[],
  })
}
