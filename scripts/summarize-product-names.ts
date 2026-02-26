/**
 * Backfill: summarize long product names in StockItem.
 * Rewrites verbose descriptions into concise names (max 120 chars).
 *
 * Usage: bun run scripts/summarize-product-names.ts [--dry-run]
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { summarizeProductName, MAX_PRODUCT_NAME_LENGTH } from '@/lib/summarize-product-name'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL required')
const adapter = new PrismaNeon({ connectionString })
const db = new PrismaClient({ adapter })

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const items = await db.stockItem.findMany({
    where: { name: { gt: '' } },
    select: { id: true, sku: true, name: true },
  })

  let updated = 0
  for (const item of items) {
    const summarized = summarizeProductName(item.name)
    if (summarized === item.name) continue
    if (summarized.length > MAX_PRODUCT_NAME_LENGTH) continue

    if (DRY_RUN) {
      console.log(`[dry-run] ${item.sku}`)
      console.log(`  before: ${item.name.slice(0, 80)}${item.name.length > 80 ? '…' : ''}`)
      console.log(`  after:  ${summarized}`)
      updated++
      continue
    }

    await db.stockItem.update({
      where: { id: item.id },
      data: { name: summarized },
    })
    updated++
  }

  console.log(DRY_RUN ? `Would update ${updated} items` : `Updated ${updated} items`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
