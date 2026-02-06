"use client"

import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TeamMember } from "@/lib/stock-store"
import { Users, MapPin, Settings } from "lucide-react"

const statusColors = {
  active: "bg-primary",
  idle: "bg-warning",
  offline: "bg-muted-foreground/40",
}

export function TeamPanel({ members }: { members: TeamMember[] }) {
  const active = members.filter((m) => m.status === "active").length
  const total = members.length

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Team</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {active}/{total} active
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
            <Link href="/settings/team" aria-label="Manage team">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col divide-y scrollbar-thin max-h-[400px] overflow-y-auto lg:max-h-none">
        {members.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No team members assigned
          </div>
        ) : (
          members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/50"
          >
            <div className="relative">
              <Avatar className="h-8 w-8 bg-secondary text-xs">
                <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                  {member.avatar}
                </AvatarFallback>
              </Avatar>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${statusColors[member.status]}`}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {member.name}
                </span>
                <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                  {member.role}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{member.zone}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono text-xs font-medium text-foreground">
                {member.itemsCounted}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {member.lastActive}
              </span>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  )
}
