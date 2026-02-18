/**
 * One-time fix: normalize SKU and name fields that have leading/trailing
 * whitespace or embedded \r/\n from Excel import.
 *
 * Usage: bun run scripts/fix-sku-whitespace.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL required')
const adapter = new PrismaNeon({ connectionString })
const db = new PrismaClient({ adapter })

async function main() {
  // PostgreSQL: trim, collapse \r\n to space, collapse multiple spaces
  const result = await db.$executeRaw`
    UPDATE "StockItem"
    SET
      sku = trim(regexp_replace(regexp_replace(sku, E'[\\r\\n]+', ' ', 'g'), E'\\s+', ' ', 'g')),
      name = trim(regexp_replace(regexp_replace(name, E'[\\r\\n]+', ' ', 'g'), E'\\s+', ' ', 'g'))
    WHERE sku != trim(regexp_replace(regexp_replace(sku, E'[\\r\\n]+', ' ', 'g'), E'\\s+', ' ', 'g'))
       OR name != trim(regexp_replace(regexp_replace(name, E'[\\r\\n]+', ' ', 'g'), E'\\s+', ' ', 'g'))
  `
  console.log(`Fixed ${result} items with malformed SKU/name.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
