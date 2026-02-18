"use client"

import { useRef } from "react"
import { Badge } from "@/components/ui/badge"
import type { ActivityEvent } from "@/lib/stock-api"
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  UserPlus,
  MapPin,
} from "lucide-react"

const eventIcons = {
  count: CheckCircle2,
  variance: AlertTriangle,
  verify: ShieldCheck,
  join: UserPlus,
  zone_complete: MapPin,
}

const eventColors = {
  count: "text-chart-2",
  variance: "text-warning",
  verify: "text-primary",
  join: "text-chart-2",
  zone_complete: "text-primary",
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const feedRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Live Activity</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-xs text-primary">Live</span>
        </div>
      </div>

      <div
        ref={feedRef}
        className="flex max-h-[400px] flex-col overflow-y-auto scrollbar-thin lg:max-h-[560px]"
      >
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-muted-foreground">
            <Activity className="h-10 w-10 opacity-30" />
            <p>No activity yet</p>
            <p className="text-xs">Counts and verifications will appear here</p>
          </div>
        ) : (
        events.map((event) => {
          const Icon = eventIcons[event.type] ?? CheckCircle2
          const color = eventColors[event.type] ?? "text-muted-foreground"
          return (
            <div
              key={event.id}
              className="flex gap-3 border-b px-4 py-2.5 last:border-b-0 transition-colors hover:bg-secondary/30"
            >
              <div className="mt-0.5 shrink-0">
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-sm leading-relaxed text-foreground">
                  <span className="font-medium">{event.user}</span>{" "}
                  <span className="text-muted-foreground">{event.message}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {event.timestamp}
                  </span>
                  {event.zone && (
                    <Badge
                      variant="outline"
                      className="h-4 px-1 py-0 text-[10px] text-muted-foreground"
                    >
                      {event.zone}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )
        })
        )}
      </div>
    </div>
  )
}
