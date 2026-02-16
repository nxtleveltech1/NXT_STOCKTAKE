"use client"

import { useOrganizationList } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Building2, Loader2, Mail, UserPlus } from "lucide-react"
import { toast } from "sonner"

export default function SelectOrgPage() {
  const router = useRouter()
  const {
    isLoaded,
    setActive,
    userMemberships,
    userInvitations,
    createOrganization,
  } = useOrganizationList({
    userMemberships: { infinite: true },
    userInvitations: { infinite: true },
  })
  const [orgName, setOrgName] = useState("")
  const [creating, setCreating] = useState(false)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)

  const memberships = userMemberships?.data ?? []
  const invitations = userInvitations?.data ?? []
  const hasOrgs = memberships.length > 0
  const hasInvitations = invitations.length > 0

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = orgName.trim()
    if (!name) {
      toast.error("Enter an organization name")
      return
    }
    setCreating(true)
    try {
      const org = await createOrganization({ name })
      await setActive({ organization: org.id })
      toast.success("Organization created")
      router.push("/")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create organization")
    } finally {
      setCreating(false)
    }
  }

  const handleSelectOrg = async (orgId: string) => {
    try {
      await setActive({ organization: orgId })
      router.push("/")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch")
    }
  }

  const handleAcceptInvitation = async (invitationId: string) => {
    setAccepting(invitationId)
    try {
      const inv = invitations.find((i) => i.id === invitationId)
      await inv?.accept()
      toast.success("Invitation accepted")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept")
    } finally {
      setAccepting(null)
    }
  }

  const handleRejectInvitation = async (invitationId: string) => {
    setRejecting(invitationId)
    try {
      const inv = invitations.find((i) => i.id === invitationId)
      await inv?.reject()
      toast.success("Invitation declined")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline")
    } finally {
      setRejecting(null)
    }
  }

  useEffect(() => {
    if (!isLoaded) return
    if (hasOrgs && !hasInvitations && memberships.length === 1) {
      setActive({ organization: memberships[0]!.organization.id }).then(() => {
        router.replace("/")
        router.refresh()
      })
    }
  }, [isLoaded, hasOrgs, hasInvitations, memberships, setActive, router])

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-foreground">
        <Building2 className="h-8 w-8 text-primary" />
        <span className="text-xl font-semibold">NXT STOCK <span className="text-primary">PULSE</span></span>
      </div>

      <div className="w-full max-w-md space-y-6">
        {hasInvitations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Pending invitations
              </CardTitle>
              <CardDescription>Accept to join a team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {inv.publicOrganizationData?.name ?? "Organization"}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rejecting === inv.id}
                      onClick={() => handleRejectInvitation(inv.id)}
                    >
                      {rejecting === inv.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Decline"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      disabled={accepting === inv.id}
                      onClick={() => handleAcceptInvitation(inv.id)}
                    >
                      {accepting === inv.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Accept"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {hasOrgs && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your teams</CardTitle>
              <CardDescription>Select a team to continue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {memberships.map((mem) => (
                <Button
                  key={mem.id}
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleSelectOrg(mem.organization.id)}
                >
                  <Building2 className="h-4 w-4" />
                  {mem.organization.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {mem.role}
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Create a team
            </CardTitle>
            <CardDescription>
              Start a new organization for your stock take team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  placeholder="e.g. SoundStage AV"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={creating}
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create and continue"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
