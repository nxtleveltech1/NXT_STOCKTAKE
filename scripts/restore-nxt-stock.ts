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

const EXCLUDE_FILE = 'nxt_stock_soh_full_20260218_092824.xlsx'

const normalize = (v: unknown): string =>
  String(v ?? '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function mapLocation(excelLoc: string): string {
  const loc = normalize(excelLoc)
  if (!loc) return 'NXT/NXT STOCK'
  if (loc.toLowerCase().includes('rental')) return 'NXT/NXT STOCK/Rental'
  if (loc.toLowerCase().includes('secondhand')) return 'NXT/NXT STOCK/Secondhand'
  if (loc.toLowerCase().includes('studio')) return 'NXT/NXT STOCK/Studio Rentals'
  if (loc.toLowerCase().includes('repair')) return 'NXT/NXT STOCK/Repairs'
  if (loc.includes('/')) return loc
  if (loc.toLowerCase().includes('nxt') && loc.toLowerCase().includes('stock')) return 'NXT/NXT STOCK'
  return loc || 'NXT/NXT STOCK'
}

async function restore() {
  const orgId = NXT_STOCK_ORG_ID

  const wb = XLSX.readFile(EXCLUDE_FILE)
  const sheetName = wb.SheetNames.find((s) => s.includes('SOH') || s.includes('Full')) ?? wb.SheetNames[0]!
  const ws = wb.Sheets[sheetName]!
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

  const existingByOdooId = new Map(
    (await db.stockItem.findMany({ where: { organizationId: orgId } })).map((r) => [r.odooId, r])
  )

  let updated = 0
  let inserted = 0

  for (const row of rows) {
    const id = row['ID']
    const odooId = typeof id === 'number' ? id : parseInt(String(id), 10) || 0
    if (!odooId) continue

    const excelLoc = normalize(row['Location']) || 'NXT/NXT STOCK'
    const targetLocation = mapLocation(excelLoc)

    const existing = existingByOdooId.get(odooId)
    if (existing) {
      if (existing.location !== targetLocation) {
        await db.stockItem.update({
          where: { id: existing.id },
          data: { location: targetLocation },
        })
        updated++
      }
    } else {
      const qty = typeof row['Quantity'] === 'number' ? row['Quantity'] : parseInt(String(row['Quantity'] || 0), 10) || 0
      const reserved = typeof row['Reserved'] === 'number' ? row['Reserved'] : parseInt(String(row['Reserved'] || 0), 10) ?? 0
      const available = typeof row['Available'] === 'number' ? row['Available'] : parseInt(String(row['Available'] || 0), 10) ?? null
      const rawSku = row['Internal Ref'] ?? row['ID'] ?? ''
      const sku = normalize(rawSku) || String(odooId)

      await db.stockItem.create({
        data: {
          organizationId: orgId,
          odooId,
          sku,
          name: normalize(row['Product']),
          category: null,
          location: targetLocation,
          warehouse: normalize(row['Warehouse']) || null,
          expectedQty: qty,
          reservedQty: Number.isNaN(reserved) ? null : reserved,
          availableQty: available != null && !Number.isNaN(available) ? available : null,
          countedQty: null,
          variance: null,
          status: 'pending',
          barcode: normalize(row['Barcode']) || null,
          uom: normalize(row['UoM']) || null,
          serialNumber: normalize(row['Serial Number']) || null,
          owner: normalize(row['Owner']) || null,
        },
      })
      inserted++
      existingByOdooId.set(odooId, { odooId } as { id: string; odooId: number })
    }
  }

  const counts = await db.stockItem.groupBy({
    by: ['location'],
    where: { organizationId: orgId },
    _count: { id: true },
  })

  console.log(`Restore complete. Updated: ${updated}, Inserted: ${inserted}`)
  console.log('Current counts by zone:')
  counts.forEach((c) => console.log(`  ${c.location}: ${c._count.id}`))
  process.exit(0)
}

restore().catch((e) => {
  console.error(e)
  process.exit(1)
})
