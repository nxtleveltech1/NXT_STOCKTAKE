"use client"

import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  fetchIssues,
  type StockIssue,
} from "@/lib/stock-api"
import { AlertCircle, Plus } from "lucide-react"

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  critical: "bg-destructive/20 text-destructive",
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const then = d.getTime()
  const diffMs = now - then
  if (diffMs < 60_000) return "Just now"
  if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)}h ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

export function IssueList({
  sessionId,
  statusFilter,
  onStatusFilterChange,
  onCreateIssue,
  onSelectIssue,
}: {
  sessionId?: string | null
  statusFilter: string
  onStatusFilterChange: (v: string) => void
  onCreateIssue: () => void
  onSelectIssue: (issue: StockIssue) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["stock", "issues", sessionId ?? "all", statusFilter],
    queryFn: () =>
      fetchIssues({
        sessionId: sessionId ?? undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        limit: 50,
      }),
  })

  const issues = data?.issues ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Issue Log</h2>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onCreateIssue}>
          <Plus className="h-3.5 w-3.5" />
          New Issue
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{total} issue{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex max-h-[400px] flex-col overflow-y-auto lg:max-h-[560px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <AlertCircle className="h-10 w-10 opacity-40" />
            <p>No issues yet</p>
            <Button variant="outline" size="sm" onClick={onCreateIssue}>
              Log first issue
            </Button>
          </div>
        ) : (
          issues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              className="flex flex-col gap-1 border-b px-4 py-3 text-left last:border-b-0 transition-colors hover:bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
              onClick={() => onSelectIssue(issue)}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-foreground line-clamp-1">
                  {issue.title}
                </span>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${priorityColors[issue.priority] ?? ""}`}
                >
                  {issue.priority}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-4 px-1 py-0 text-[10px]">
                  {statusLabels[issue.status] ?? issue.status}
                </Badge>
                {issue.zone && (
                  <span className="text-xs text-muted-foreground">{issue.zone}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {issue.reporterName} · {formatTimestamp(issue.createdAt)}
                </span>
                {issue.commentCount != null && issue.commentCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {issue.commentCount} comment{issue.commentCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
