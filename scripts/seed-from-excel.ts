import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL required')
const adapter = new PrismaNeon({ connectionString })
const db = new PrismaClient({ adapter })

const EXCEL_PATH = 'odoo_soh_full_20260215_095441.xlsx'

async function seed() {
  const wb = XLSX.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]!]!
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  })

  // Excel columns: ID, Product, Internal Ref, UoM, Serial Number, Barcode, Location, Warehouse, Quantity, Reserved, Available, Owner
  const headers = ['ID', 'Product', 'Internal Ref', 'UoM', 'Serial Number', 'Barcode', 'Location', 'Warehouse', 'Quantity', 'Reserved', 'Available', 'Owner']

  const BATCH_SIZE = 500

  const existing = await db.stockItem.count()
  if (existing > 0) {
    console.log(`Clearing ${existing} existing StockItems...`)
    await db.stockItem.deleteMany({})
  }

  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((row) => {
      const id = row['ID']
      const odooId = typeof id === 'number' ? id : parseInt(String(id), 10) || 0
      const qty = typeof row['Quantity'] === 'number' ? row['Quantity'] : parseInt(String(row['Quantity'] || 0), 10) || 0
      const reserved = typeof row['Reserved'] === 'number' ? row['Reserved'] : parseInt(String(row['Reserved'] || 0), 10) ?? 0
      const available = typeof row['Available'] === 'number' ? row['Available'] : parseInt(String(row['Available'] || 0), 10) ?? null

      return {
        odooId,
        sku: String(row['Internal Ref'] ?? row['ID'] ?? ''),
        name: String(row['Product'] ?? ''),
        category: null as string | null,
        location: String(row['Location'] ?? ''),
        warehouse: (row['Warehouse'] as string) || null,
        expectedQty: qty,
        reservedQty: Number.isNaN(reserved) ? null : reserved,
        availableQty: available != null && !Number.isNaN(available) ? available : null,
        countedQty: null,
        variance: null,
        status: 'pending' as const,
        barcode: (row['Barcode'] as string) || null,
        uom: (row['UoM'] as string) || null,
        serialNumber: (row['Serial Number'] as string) || null,
        owner: (row['Owner'] as string) || null,
      }
    })

    await db.stockItem.createMany({ data: batch })
    inserted += batch.length
    process.stdout.write(`\rInserted ${inserted}/${rows.length}`)
  }

  const total = await db.stockItem.count()

  // Create default session
  const sessions = await db.stockSession.findMany()
  if (sessions.length === 0) {
    await db.stockSession.create({
      data: {
        name: 'Q1 Full Stock Take',
        status: 'live',
        location: 'NXT Stock',
        totalItems: total,
        countedItems: 0,
        varianceItems: 0,
        verifiedItems: 0,
        teamMembers: 0,
      },
    })
  } else {
    await db.stockSession.updateMany({ where: {}, data: { totalItems: total } })
  }

  console.log(`\nDone. ${total} StockItems seeded.`)
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
