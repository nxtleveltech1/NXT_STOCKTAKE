"use client"

import { MapPin } from "lucide-react"

type Zone = {
  name: string
  code: string
  totalItems: number
  countedItems: number
  variances: number
  assignee: string
}

export function ZoneProgress({ zones = [] }: { zones?: Zone[] }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Zone Progress</h2>
        </div>
      </div>

      <div className="flex flex-col divide-y">
        {zones.map((zone, i) => {
          const pct = Math.round((zone.countedItems / zone.totalItems) * 100)
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-semibold text-primary">
                {zone.code}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {zone.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {zone.countedItems}/{zone.totalItems}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{zone.assignee}</span>
                  <span>
                    {zone.variances > 0 && (
                      <span className="text-warning">
                        {zone.variances} variances
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
