/**
 * Diagnose missing SKUs: compare Excel file vs platform DB.
 * Usage: bun run scripts/diagnose-missing-skus.ts [path-to-excel]
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { NXT_STOCK_ORG_ID } from '@/lib/org'

const EXCEL_PATH = process.argv[2] ?? resolve(process.cwd(), 'nxt_stock_soh_full_20260218_092824.xlsx')

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL required')
const adapter = new PrismaNeon({ connectionString })
const db = new PrismaClient({ adapter })

async function main() {
  console.log('=== Missing SKU Diagnostic ===\n')
  console.log('Excel:', EXCEL_PATH)

  // 1. Read Excel
  const wb = XLSX.readFile(EXCEL_PATH)
  const sheetName = wb.SheetNames.find((s) => s.includes('SOH') || s.includes('Full')) ?? wb.SheetNames[0]!
  const ws = wb.Sheets[sheetName]!
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

  console.log('Sheet:', sheetName)
  console.log('Rows:', rows.length)

  const firstRow = rows[0] ?? {}
  const excelColumns = Object.keys(firstRow)
  console.log('Excel columns:', excelColumns.join(', '))

  // Map Excel SKUs (same logic as seed-from-excel)
  const skuColumn = excelColumns.find((c) =>
    /internal\s*ref|sku|default_code|internalref/i.test(c)
  ) ?? excelColumns.find((c) => c === 'ID')
  const idColumn = excelColumns.find((c) => c === 'ID') ?? excelColumns[0]

  const excelSkus = new Map<string, { id: unknown; product: string }>()
  const excelIds = new Set<number>()
  let duplicateIds = 0
  let emptySku = 0

  for (const row of rows) {
    const id = row[idColumn ?? 'ID']
    const odooId = typeof id === 'number' ? id : parseInt(String(id), 10) || 0
    if (odooId && excelIds.has(odooId)) duplicateIds++
    excelIds.add(odooId)

    const sku = String(row[skuColumn ?? 'Internal Ref'] ?? row['ID'] ?? '').trim()
    if (!sku) emptySku++
    excelSkus.set(sku || `__id_${odooId}`, { id: row[idColumn ?? 'ID'], product: String(row['Product'] ?? '') })
  }

  console.log('\nExcel SKU mapping:')
  console.log('  SKU column used:', skuColumn ?? 'Internal Ref (fallback)')
  console.log('  Unique SKUs/rows:', excelSkus.size)
  console.log('  Duplicate odooIds:', duplicateIds)
  console.log('  Rows with empty SKU:', emptySku)

  // 2. Query DB
  const dbItems = await db.stockItem.findMany({
    where: { organizationId: NXT_STOCK_ORG_ID },
    select: { sku: true, odooId: true, name: true },
  })
  const dbSkus = new Set(dbItems.map((i) => i.sku))
  const dbOdooIds = new Set(dbItems.map((i) => i.odooId))

  console.log('\nDB:')
  console.log('  Total items:', dbItems.length)
  console.log('  Unique SKUs:', dbSkus.size)

  // 3. Compare
  const excelSkuList = [...excelSkus.keys()].filter((s) => !s.startsWith('__id_'))
  const missingInDb = excelSkuList.filter((sku) => !dbSkus.has(sku))
  const missingInExcel = [...dbSkus].filter((sku) => !excelSkus.has(sku) && !excelSkuList.includes(sku))

  // Also check by odooId (Excel ID column)
  const excelOdooIds = new Set(
    rows.map((r) => {
      const id = r[idColumn ?? 'ID']
      return typeof id === 'number' ? id : parseInt(String(id), 10) || 0
    })
  )
  const missingOdooIds = [...excelOdooIds].filter((id) => id && !dbOdooIds.has(id))

  console.log('\n=== Comparison ===')
  console.log('Excel rows:', rows.length)
  console.log('DB items:', dbItems.length)
  console.log('Gap:', rows.length - dbItems.length)
  console.log('\nSKUs in Excel but NOT in DB:', missingInDb.length)
  if (missingInDb.length > 0 && missingInDb.length <= 20) {
    missingInDb.slice(0, 20).forEach((s) => {
      const info = excelSkus.get(s)
      console.log('  -', s, info ? `(Product: ${info.product})` : '')
    })
  } else if (missingInDb.length > 20) {
    missingInDb.slice(0, 10).forEach((s) => console.log('  -', s))
    console.log('  ... and', missingInDb.length - 10, 'more')
  }

  console.log('\nIDs in Excel but NOT in DB:', missingOdooIds.length)
  if (missingOdooIds.length > 0 && missingOdooIds.length <= 15) {
    console.log('  ', missingOdooIds.join(', '))
  } else if (missingOdooIds.length > 15) {
    console.log('  ', missingOdooIds.slice(0, 10).join(', '), '...')
  }

  // 4. Check for createMany failures (duplicate odooId)
  console.log('\n=== Potential causes ===')
  if (duplicateIds > 0) {
    console.log('• Duplicate odooIds in Excel:', duplicateIds, '- Prisma createMany would fail on unique constraint')
  }
  if (excelColumns.every((c) => !/internal\s*ref|sku|internalref/i.test(c))) {
    console.log('• No "Internal Ref" or "SKU" column - seed uses ID as SKU fallback')
  }
  if (rows.length > dbItems.length) {
    console.log('• Excel has more rows than DB - seed may have failed or filtered some out')
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
