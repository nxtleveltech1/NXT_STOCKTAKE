/**
 * invite-team-members.ts
 * Adds users to NXT STOCK PULSE org: existing Clerk users via createOrganizationMembership,
 * others via createOrganizationInvitation.
 *
 * Usage: bun run scripts/invite-team-members.ts
 * Requires: CLERK_SECRET_KEY and optionally CLERK_ORG_ID in .env.local
 */

import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env.local"), override: true })

import { createClerkClient } from "@clerk/nextjs/server"

const EMAILS = [
  "jason@nxtleveltech.co.za",
  "herbstcaleb1@gmail.com",
  "newtonstephens4@gmail.com",
  "booysenr708@gmail.com",
] as const

const ROLE = "org:member" as const

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    console.error("CLERK_SECRET_KEY required in .env.local")
    process.exit(1)
  }

  const clerk = createClerkClient({ secretKey })
  let orgId = process.env.CLERK_ORG_ID

  if (!orgId) {
    const { data } = await clerk.organizations.getOrganizationList({
      limit: 20,
      query: "NXT",
    })
    const org =
      data.find((o) => /nxt|stock|pulse/i.test(o.name ?? "")) ?? data[0]
    if (!org) {
      console.error("No organization found. Set CLERK_ORG_ID in .env.local")
      process.exit(1)
    }
    orgId = org.id
    console.log(`Using org: ${org.name} (${orgId})`)
  }

  for (const email of EMAILS) {
    try {
      const { data: users } = await clerk.users.getUserList({
        emailAddress: [email],
        limit: 1,
      })
      const user = users[0]

      if (user) {
        await clerk.organizations.createOrganizationMembership({
          organizationId: orgId,
          userId: user.id,
          role: ROLE,
        })
        console.log(`✓ Added ${email} (existing user)`)
      } else {
        await clerk.organizations.createOrganizationInvitation({
          organizationId: orgId,
          emailAddress: email,
          role: ROLE,
        })
        console.log(`✓ Invited ${email} (invitation sent)`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const skip =
        msg.includes("already a member") ||
        msg.includes("already invited") ||
        msg.includes("already in the organization") ||
        msg.includes("Forbidden") ||
        msg.includes("Bad Request")
      if (skip) {
        console.log(`⊘ ${email} – already member or invited`)
      } else {
        console.error(`✗ ${email}: ${msg}`)
      }
    }
  }

  console.log("\nDone. Users added or invited to NXT STOCK PULSE.")
}

main()
