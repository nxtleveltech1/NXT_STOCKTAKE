/**
 * backfill-stock-item-org.ts
 * Sets organizationId on StockItem records that have null.
 * Requires CLERK_ORG_ID in .env.local (NXT STOCK org from Clerk).
 *
 * Usage: bun run scripts/backfill-stock-item-org.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import { db } from '@/lib/db'

async function main() {
  const orgId = process.env.CLERK_ORG_ID
  if (!orgId) {
    console.error('CLERK_ORG_ID required in .env.local')
    process.exit(1)
  }

  const result = await db.stockItem.updateMany({
    where: { organizationId: null },
    data: { organizationId: orgId },
  })

  console.log(`Updated ${result.count} StockItem(s) with organizationId`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
