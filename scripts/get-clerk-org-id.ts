/**
 * Fetches org IDs from Clerk API and optionally runs backfill.
 * Usage: bun run scripts/get-clerk-org-id.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY
if (!CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY required in .env.local')
  process.exit(1)
}

async function getOrganizations() {
  const res = await fetch('https://api.clerk.com/v1/organizations?limit=50', {
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Clerk API error ${res.status}: ${text}`)
  }
  const data = (await res.json()) as { data: { id: string; name: string; slug: string }[] }
  return data.data
}

async function main() {
  const orgs = await getOrganizations()
  if (orgs.length === 0) {
    console.error('No organizations found in Clerk')
    process.exit(1)
  }

  const nxtStock = orgs.find(
    (o) =>
      o.name?.toLowerCase().includes('nxt') ||
      o.name?.toLowerCase().includes('stock') ||
      o.slug?.toLowerCase().includes('nxt')
  )
  const org = nxtStock ?? orgs[0]!
  const orgId = org.id

  console.log(`Organizations: ${orgs.map((o) => `${o.name} (${o.id})`).join(', ')}`)
  console.log(`Using org: ${org.name} (${orgId})`)

  process.env.CLERK_ORG_ID = orgId

  const { db } = await import('@/lib/db')
  const result = await db.stockItem.updateMany({
    where: { organizationId: null },
    data: { organizationId: orgId },
  })
  console.log(`Updated ${result.count} StockItem(s) with organizationId`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
