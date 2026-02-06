"use server"

import { auth } from "@clerk/nextjs/server"
import { clerkClient } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

const ADMIN_ROLE = "org:admin"
const MEMBER_ROLE = "org:member"
type OrgRole = typeof ADMIN_ROLE | typeof MEMBER_ROLE

function assertAdmin(orgRole: string | undefined): void {
  if (orgRole !== ADMIN_ROLE) {
    throw new Error("Only admins can perform this action")
  }
}

export async function inviteTeamMember(formData: FormData) {
  const { userId, orgId, orgRole } = await auth()
  if (!userId || !orgId) throw new Error("Unauthorized")
  assertAdmin(orgRole)

  const email = (formData.get("email") as string)?.trim()
  const role = (formData.get("role") as OrgRole) || MEMBER_ROLE
  if (!email) throw new Error("Email is required")

  try {
    const client = await clerkClient()
    await client.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: email,
      role: role === "admin" ? ADMIN_ROLE : MEMBER_ROLE,
    })
    revalidatePath("/settings/team")
    revalidatePath("/")
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send invitation",
    }
  }
}

export async function updateMemberRole(userId: string, role: OrgRole) {
  const { orgId, orgRole } = await auth()
  if (!orgId) throw new Error("Unauthorized")
  assertAdmin(orgRole)

  const normalizedRole = role === "admin" ? ADMIN_ROLE : MEMBER_ROLE
  try {
    const client = await clerkClient()
    await client.organizations.updateOrganizationMembership({
      organizationId: orgId,
      userId,
      role: normalizedRole,
    })
    revalidatePath("/settings/team")
    revalidatePath("/")
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update role",
    }
  }
}

export async function removeMember(userId: string) {
  const { orgId, orgRole } = await auth()
  if (!orgId) throw new Error("Unauthorized")
  assertAdmin(orgRole)

  try {
    const client = await clerkClient()
    await client.organizations.deleteOrganizationMembership({
      organizationId: orgId,
      userId,
    })
    revalidatePath("/settings/team")
    revalidatePath("/")
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to remove member",
    }
  }
}

export async function revokeInvitation(invitationId: string) {
  const { orgId, orgRole } = await auth()
  if (!orgId) throw new Error("Unauthorized")
  assertAdmin(orgRole)

  try {
    const client = await clerkClient()
    await client.organizations.revokeOrganizationInvitation({
      organizationId: orgId,
      invitationId,
    })
    revalidatePath("/settings/team")
    revalidatePath("/")
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to revoke invitation",
    }
  }
}
