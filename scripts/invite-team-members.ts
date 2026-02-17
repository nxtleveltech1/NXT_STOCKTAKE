/**
 * invite-team-members.ts
 * Adds ALL Clerk users directly to the NXT STOCK PULSE org as members.
 * No invitations — instant membership via createOrganizationMembership.
 *
 * Usage: bun run scripts/invite-team-members.ts
 */

import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env.local"), override: true })

import { createClerkClient } from "@clerk/nextjs/server"

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

  // 2. Get current org member user IDs
  const existingMembers = new Set<string>()
  let offset = 0
  while (true) {
    const { data } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 100,
      offset,
    })
    if (data.length === 0) break
    for (const m of data) {
      if (m.publicUserData?.userId) existingMembers.add(m.publicUserData.userId)
    }
    offset += data.length
  }
  console.log(`Current members: ${existingMembers.size}`)

  // 3. Get ALL Clerk users
  const allUsers: { id: string; email: string; name: string }[] = []
  offset = 0
  while (true) {
    const { data } = await clerk.users.getUserList({ limit: 100, offset })
    if (data.length === 0) break
    for (const u of data) {
      const email = u.emailAddresses?.[0]?.emailAddress ?? "—"
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || email
      allUsers.push({ id: u.id, email, name })
    }
    offset += data.length
  }
  console.log(`Total Clerk users: ${allUsers.length}\n`)

  // 4. Add missing users to org
  let added = 0
  for (const user of allUsers) {
    if (existingMembers.has(user.id)) {
      console.log(`⊘ ${user.email} – already member`)
      continue
    }
    try {
      await clerk.organizations.createOrganizationMembership({
        organizationId: orgId,
        userId: user.id,
        role: ROLE,
      })
      added++
      console.log(`✓ ${user.email} – added as member`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`✗ ${user.email}: ${msg}`)
    }
  }

  console.log(`\nDone. Added ${added} new member(s) to NXT STOCK PULSE.`)
}

main()
