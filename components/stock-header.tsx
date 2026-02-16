"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { StockSession, TeamMember } from "@/lib/stock-store"
import {
  BarChart3,
  ChevronDown,
  Clock,
  Pause,
  Play,
  Radio,
  Settings,
  Users,
  UserCog,
  Wifi,
  Menu,
  X,
} from "lucide-react"

function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
    </span>
  )
}

function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState("")

  useEffect(() => {
    function updateElapsed() {
      const start = new Date(startedAt).getTime()
      const now = Date.now()
      const diff = now - start
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setElapsed(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      )
    }
    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <span className="font-mono text-sm tabular-nums text-muted-foreground">{elapsed}</span>
  )
}

const statusDot = {
  active: "bg-primary",
  idle: "bg-amber-500",
  offline: "bg-muted-foreground/40",
}

function OnlinePopover({
  count,
  members,
}: {
  count: number
  members: TeamMember[]
}) {
  const online = members.filter((m) => m.status === "active" || m.status === "idle")
  const displayCount = online.length > 0 ? online.length : count

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Who's online"
        >
          <Users className="h-4 w-4 shrink-0" />
          <span>{displayCount} online</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Who&apos;s online</p>
        </div>
        <ul className="max-h-56 overflow-y-auto py-1">
          {online.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">
              No one online right now
            </li>
          ) : (
            online.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <div className="relative shrink-0">
                  <Avatar className="h-7 w-7 bg-secondary text-xs">
                    <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                      {m.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background ${statusDot[m.status]}`}
                  />
                </div>
                <span className="truncate font-medium text-foreground">{m.name}</span>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function StockHeader({
  session,
  onToggleSession,
  onlineMembers = [],
}: {
  session: StockSession
  onToggleSession: () => void
  onlineMembers?: TeamMember[]
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        {/* Left: Logo & Session */}
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden text-lg font-semibold tracking-tight text-foreground sm:inline">
              NXT STOCK <span className="text-primary">PULSE</span>
            </span>
          </div>

          <div className="hidden h-6 w-px bg-border md:block" />

          <div className="hidden items-center gap-2 md:flex">
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/30 bg-primary/10 text-primary"
            >
              <LivePulse />
              {session.status === "live" ? "LIVE" : "PAUSED"}
            </Badge>
            <span className="text-sm font-medium text-foreground">{session.id}</span>
            <span className="text-sm text-muted-foreground">{session.name}</span>
          </div>
        </div>

        {/* Center: Timer (desktop) */}
        <div className="hidden items-center gap-3 lg:flex">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <ElapsedTime startedAt={session.startedAt} />
          <div className="h-4 w-px bg-border" />
          <OnlinePopover count={session.teamMembers} members={onlineMembers} />
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-primary">Synced</span>
          </div>
        </div>

        {/* Mobile timer */}
        <div className="flex items-center gap-2 lg:hidden">
          <LivePulse />
          <ElapsedTime startedAt={session.startedAt} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-1.5 sm:flex bg-transparent"
            onClick={onToggleSession}
          >
            {session.status === "live" ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Resume
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden gap-1.5 sm:flex bg-transparent">
                <Radio className="h-3.5 w-3.5" />
                Actions
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>Export Progress</DropdownMenuItem>
              <DropdownMenuItem>Generate Report</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Assign Zones</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/team" className="flex items-center gap-2">
                  <UserCog className="h-3.5 w-3.5" />
                  Team & access
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                End Session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden items-center gap-1 sm:flex">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/"
              afterCreateOrganizationUrl="/select-org"
              afterLeaveOrganizationUrl="/select-org"
              appearance={{
                elements: {
                  rootBox: "flex",
                  organizationSwitcherTrigger:
                    "border border-input bg-background rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                },
              }}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/settings/team" aria-label="Team settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </div>

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span className="sr-only">Menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile expanded menu */}
      {mobileMenuOpen && (
        <div className="border-t px-4 py-3 lg:hidden">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="gap-1.5 border-primary/30 bg-primary/10 text-primary"
              >
                <LivePulse />
                {session.status === "live" ? "LIVE" : "PAUSED"}
              </Badge>
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-primary">Synced</span>
              </div>
            </div>
            <div className="text-sm">
              <span className="font-medium text-foreground">{session.id}</span>
              <span className="text-muted-foreground"> - {session.name}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <OnlinePopover count={session.teamMembers} members={onlineMembers} />
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {session.location}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 bg-transparent"
                onClick={onToggleSession}
              >
                {session.status === "live" ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1.5 bg-transparent" asChild>
                <Link href="/settings/team">
                  <Settings className="h-3.5 w-3.5" />
                  Team
                </Link>
              </Button>
            </div>
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <OrganizationSwitcher
                hidePersonal
                afterSelectOrganizationUrl="/"
                afterCreateOrganizationUrl="/select-org"
                appearance={{
                  elements: {
                    rootBox: "flex",
                    organizationSwitcherTrigger:
                      "border border-input bg-background rounded-md px-2 py-1.5 text-sm",
                  },
                }}
              />
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
