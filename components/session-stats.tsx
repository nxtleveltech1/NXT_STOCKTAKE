"use client"

import React from "react"

import { useEffect, useState } from "react"
import type { StockSession } from "@/lib/stock-store"
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"

function AnimatedCounter({
  value,
  duration = 1200,
}: {
  value: number
  duration?: number
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let start = 0
    const end = value
    const startTime = Date.now()

    function tick() {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.floor(start + (end - start) * eased)
      setDisplay(current)
      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    tick()
  }, [value, duration])

  return <>{display.toLocaleString('en-US')}</>
}

function StatCard({
  label,
  value,
  total,
  icon: Icon,
  color,
  percentage,
}: {
  label: string
  value: number
  total?: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  percentage?: number
}) {
  const pct = percentage ?? (total ? Math.round((value / total) * 100) : 0)

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/50">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-foreground lg:text-3xl">
              <AnimatedCounter value={value} />
            </span>
            {total && (
              <span className="text-sm text-muted-foreground">
                / {total.toLocaleString('en-US')}
              </span>
            )}
          </div>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{pct}% complete</span>
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${pct}%`,
              backgroundColor: color,
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function SessionStats({ session }: { session: StockSession }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <StatCard
        label="Total Items"
        value={session.totalItems}
        icon={Package}
        color="hsl(200, 65%, 46%)"
        percentage={100}
      />
      <StatCard
        label="Counted"
        value={session.countedItems}
        total={session.totalItems}
        icon={CheckCircle2}
        color="hsl(152, 55%, 38%)"
      />
      <StatCard
        label="Variances"
        value={session.varianceItems}
        total={session.countedItems}
        icon={AlertTriangle}
        color="hsl(32, 90%, 46%)"
      />
      <StatCard
        label="Verified"
        value={session.verifiedItems}
        total={session.countedItems}
        icon={ShieldCheck}
        color="hsl(200, 65%, 46%)"
      />
    </div>
  )
}
