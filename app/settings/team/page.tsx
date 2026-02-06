"use client"

import { useAuth, useOrganization } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { inviteTeamMember, removeMember, revokeInvitation, updateMemberRole } from "@/app/actions/team"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Mail,
  MoreHorizontal,
  UserMinus,
  UserPlus,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

const ROLE_LABEL: Record<string, string> = {
  "org:admin": "Admin",
  "org:member": "Member",
}

export default function TeamPage() {
  const router = useRouter()
  const { userId: currentUserId } = useAuth()
  const {
    isLoaded,
    organization,
    membership,
    memberships,
    invitations,
  } = useOrganization({
    memberships: { infinite: true },
    invitations: { infinite: true },
  })

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"org:admin" | "org:member">("org:member")
  const [inviting, setInviting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string
    name: string
  } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [roleTarget, setRoleTarget] = useState<{
    userId: string
    currentRole: string
  } | null>(null)
  const [updatingRole, setUpdatingRole] = useState(false)

  const isAdmin = membership?.role === "org:admin"
  const members = memberships?.data ?? []
  const pendingInvites = invitations?.data ?? []

  useEffect(() => {
    if (isLoaded && !organization) {
      router.replace("/select-org")
    }
  }, [isLoaded, organization, router])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return
    setInviting(true)
    const formData = new FormData()
    formData.set("email", email)
    formData.set("role", inviteRole)
    const result = await inviteTeamMember(formData)
    setInviting(false)
    if (result.ok) {
      toast.success("Invitation sent")
      setInviteEmail("")
      setInviteOpen(false)
    } else {
      toast.error(result.error)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    const result = await removeMember(removeTarget.userId)
    setRemoving(false)
    setRemoveTarget(null)
    if (result.ok) toast.success("Member removed")
    else toast.error(result.error)
  }

  const handleUpdateRole = async (userId: string, role: "org:admin" | "org:member") => {
    setUpdatingRole(true)
    const result = await updateMemberRole(userId, role)
    setUpdatingRole(false)
    setRoleTarget(null)
    if (result.ok) toast.success("Role updated")
    else toast.error(result.error)
  }

  const handleRevokeInvite = async (invitationId: string) => {
    const result = await revokeInvitation(invitationId)
    if (result.ok) toast.success("Invitation revoked")
    else toast.error(result.error)
  }

  if (!isLoaded) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!organization) return null

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Team members</CardTitle>
              <CardDescription>
                {organization.name} · {members.length} member{members.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => setInviteOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {members.map((mem) => {
            const name =
              mem.publicUserData?.firstName && mem.publicUserData?.lastName
                ? `${mem.publicUserData.firstName} ${mem.publicUserData.lastName}`
                : mem.publicUserData?.identifier ?? "Member"
            const initials = name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
            const isCurrentUser = mem.publicUserData?.userId === currentUserId
            const canManage = isAdmin && !isCurrentUser

            return (
              <div
                key={mem.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{name}</span>
                      {isCurrentUser && (
                        <Badge variant="secondary" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABEL[mem.role] ?? mem.role}
                    </p>
                  </div>
                </div>
                {canManage && mem.publicUserData?.userId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setRoleTarget({
                            userId: mem.publicUserData.userId,
                            currentRole: mem.role,
                          })
                        }
                      >
                        Change role
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          setRemoveTarget({
                            userId: mem.publicUserData.userId,
                            name,
                          })
                        }
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {pendingInvites.length > 0 && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Pending invitations
            </CardTitle>
            <CardDescription>Revoke to cancel an invitation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5"
              >
                <span className="text-sm font-medium">{inv.emailAddress}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {ROLE_LABEL[inv.role] ?? inv.role}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRevokeInvite(inv.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {inviteOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invite by email</CardTitle>
            <CardDescription>They will receive an email to join this team</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviting}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as "org:admin" | "org:member")}
                  disabled={inviting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org:member">Member</SelectItem>
                    <SelectItem value="org:admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInviteOpen(false)
                    setInviteEmail("")
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviting}>
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Send invitation"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${removeTarget.name} will lose access to this team. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!roleTarget} onOpenChange={() => setRoleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role</AlertDialogTitle>
            <AlertDialogDescription>
              Admins can invite and remove members and manage settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {roleTarget && (
            <div className="flex gap-2 py-4">
              <Select
                defaultValue={roleTarget.currentRole}
                onValueChange={(v) =>
                  handleUpdateRole(roleTarget.userId, v as "org:admin" | "org:member")
                }
                disabled={updatingRole}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org:member">Member</SelectItem>
                  <SelectItem value="org:admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Done</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
