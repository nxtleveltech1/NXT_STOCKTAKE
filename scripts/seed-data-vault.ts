import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { NXT_STOCK_ORG_ID } from '@/lib/org'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL required')
const adapter = new PrismaNeon({ connectionString })
const db = new PrismaClient({ adapter })

const DATA_VAULT_LOCATION = 'NXT/NXT DATA VAULT'
const EXCLUDE_FILE = 'nxt_stock_soh_full_20260218_092824.xlsx'
const SOURCE_FILE = 'nxt_stock_soh_full_20260219_063241.xlsx'

const normalize = (v: unknown): string =>
  String(v ?? '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function loadRows(path: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(path)
  const sheetName = wb.SheetNames.find((s) => s.includes('SOH') || s.includes('Full')) ?? wb.SheetNames[0]!
  const ws = wb.Sheets[sheetName]!
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })
}

async function seedDataVault() {
  const orgId = NXT_STOCK_ORG_ID
  const BATCH_SIZE = 500

  // 1. Build exclude set from 20260218 (NXT STOCK / Rentals initial load)
  console.log(`Loading exclude set from ${EXCLUDE_FILE}...`)
  const excludeRows = loadRows(EXCLUDE_FILE)
  const excludeSkus = new Set(
    excludeRows.map((row) => {
      const raw = row['Internal Ref'] ?? row['ID'] ?? ''
      return normalize(raw) || String(row['ID'] ?? '')
    }).filter(Boolean)
  )
  console.log(`Excluding ${excludeSkus.size} SKUs from initial load`)

  // 2. Load 20260219 (all Odoo products) and filter
  console.log(`Loading source data from ${SOURCE_FILE}...`)
  const sourceRows = loadRows(SOURCE_FILE)
  const toInsert = sourceRows.filter((row) => {
    const rawSku = row['Internal Ref'] ?? row['ID'] ?? ''
    const sku = normalize(rawSku) || String(row['ID'] ?? '')
    return !excludeSkus.has(sku)
  })
  console.log(`Filtered to ${toInsert.length} rows (excluded ${sourceRows.length - toInsert.length})`)

  // 3. Get existing odooIds to avoid unique constraint violations
  const existingOdooIds = new Set(
    (await db.stockItem.findMany({ select: { odooId: true } })).map((r) => r.odooId)
  )

  // 4. Build batch data: assign synthetic odooId for empty IDs, skip existing, dedupe by final odooId
  const SYNTHETIC_BASE = 900_000_000
  let syntheticIndex = 0
  const usedOdooIds = new Set(existingOdooIds)
  const batchData = toInsert
    .map((row) => {
      const id = row['ID']
      let odooId = typeof id === 'number' ? id : parseInt(String(id || ''), 10) || 0
      if (odooId === 0 || usedOdooIds.has(odooId)) {
        odooId = SYNTHETIC_BASE + syntheticIndex++
      }
      usedOdooIds.add(odooId)
      if (existingOdooIds.has(odooId)) return null

      const qty = typeof row['Quantity'] === 'number' ? row['Quantity'] : parseInt(String(row['Quantity'] || 0), 10) || 0
      const reserved = typeof row['Reserved'] === 'number' ? row['Reserved'] : parseInt(String(row['Reserved'] || 0), 10) ?? 0
      const available = typeof row['Available'] === 'number' ? row['Available'] : parseInt(String(row['Available'] || 0), 10) ?? null

      const rawSku = row['Internal Ref'] ?? row['ID'] ?? ''
      const sku = normalize(rawSku) || String(odooId)

      return {
        organizationId: orgId,
        odooId,
        sku,
        name: normalize(row['Product']),
        category: null as string | null,
        location: DATA_VAULT_LOCATION,
        warehouse: normalize(row['Warehouse']) || null,
        expectedQty: qty,
        reservedQty: Number.isNaN(reserved) ? null : reserved,
        availableQty: available != null && !Number.isNaN(available) ? available : null,
        countedQty: null,
        variance: null,
        status: 'pending' as const,
        barcode: normalize(row['Barcode']) || null,
        uom: normalize(row['UoM']) || null,
        serialNumber: normalize(row['Serial Number']) || null,
        owner: normalize(row['Owner']) || null,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  // 6. Batch insert
  let inserted = 0
  for (let i = 0; i < batchData.length; i += BATCH_SIZE) {
    const batch = batchData.slice(i, i + BATCH_SIZE)
    await db.stockItem.createMany({ data: batch })
    inserted += batch.length
    process.stdout.write(`\rInserted ${inserted}/${batchData.length}`)
  }

  const dataVaultCount = await db.stockItem.count({
    where: { organizationId: orgId, location: DATA_VAULT_LOCATION },
  })
  console.log(`\nDone. ${dataVaultCount} items in NXT DATA VAULT.`)
  process.exit(0)
}

seedDataVault().catch((e) => {
  console.error(e)
  process.exit(1)
})
