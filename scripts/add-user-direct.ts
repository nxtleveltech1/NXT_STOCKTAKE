/**
 * add-user-direct.ts
 * Creates a user in Clerk and adds them directly to the org.
 * No invites — createUser (email auto-verified) + createOrganizationMembership.
 *
 * Usage: bun run scripts/add-user-direct.ts
 */

import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env.local"), override: true })

import { createClerkClient } from "@clerk/nextjs/server"

const EMAIL = "accounts@nxtleveltech.co.za"
const PASSWORD = "BrilliantBrends1"
const ROLE = "org:member" as const

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    console.error("CLERK_SECRET_KEY required in .env.local")
    process.exit(1)
  }

  const clerk = createClerkClient({ secretKey })

  // 1. Resolve org
  let orgId = process.env.CLERK_ORG_ID
  if (!orgId) {
    const { data } = await clerk.organizations.getOrganizationList({ limit: 20 })
    const org = data.find((o) => o.name === "NXT STOCK") ?? data[0]
    if (!org) {
      console.error("No organization found. Set CLERK_ORG_ID in .env.local")
      process.exit(1)
    }
    orgId = org.id
    console.log(`Org: ${org.name} (${orgId})\n`)
  }

  // 2. Check if user already exists
  const existing = await clerk.users.getUserList({ emailAddress: [EMAIL], limit: 1 })
  let userId: string

  if (existing.data.length > 0) {
    userId = existing.data[0].id
    console.log(`User ${EMAIL} already exists (${userId})`)
  } else {
    // 3. Create user (email auto-verified, no invite)
    const user = await clerk.users.createUser({
      emailAddress: [EMAIL],
      password: PASSWORD,
    })
    userId = user.id
    console.log(`Created user ${EMAIL} (${userId})`)
  }

  // 4. Add to org (direct membership, no invite)
  try {
    await clerk.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId,
      role: ROLE,
    })
    console.log(`Added ${EMAIL} to org as ${ROLE}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("already a member") || msg.includes("already exists")) {
      console.log(`${EMAIL} already in org`)
    } else {
      throw err
    }
  }

  console.log("\nDone. User ready to sign in.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
