"use client"

import { useState, useCallback, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { StockHeader } from "@/components/stock-header"
import { CreateIssueSheet } from "@/components/create-issue-sheet"
import { IssueDetailSheet } from "@/components/issue-detail-sheet"
import { IssuesTable } from "@/components/issues-table"
import {
  fetchStockSession,
  fetchIssues,
  fetchZones,
} from "@/lib/stock-api"
import type { StockIssue } from "@/lib/stock-api"
import { ISSUE_CLASSIFICATIONS } from "@/lib/constants"
import { AlertCircle, ArrowLeft, Download, Plus, RefreshCw, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function IssuesPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [classificationFilter, setClassificationFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [searchDebounced, setSearchDebounced] = useState("")
  const [page, setPage] = useState(0)
  const limit = 50
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: session } = useQuery({
    queryKey: ["stock", "session"],
    queryFn: fetchStockSession,
    refetchInterval: 5_000,
  })

  const { data: zones = [] } = useQuery({
    queryKey: ["stock", "zones"],
    queryFn: fetchZones,
  })

  const sessionId = session?.id && session.id !== "default" ? session.id : undefined

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ["stock", "issues", sessionId ?? "all", statusFilter, priorityFilter, classificationFilter, searchDebounced, page],
    queryFn: () =>
      fetchIssues({
        sessionId,
        status: statusFilter !== "all" ? statusFilter : undefined,
        priority: priorityFilter !== "all" ? priorityFilter : undefined,
        classification: classificationFilter !== "all" ? classificationFilter : undefined,
        search: searchDebounced || undefined,
        limit,
        offset: page * limit,
      }),
  })

  const issues = data?.issues ?? []
  const total = data?.total ?? 0

  const handleSelectIssue = useCallback((issue: StockIssue) => {
    setDetailId(issue.id)
    setDetailOpen(true)
  }, [])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stock", "issues"] })
  }, [queryClient])

  const handleIssueSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stock", "issues"] })
    setDetailOpen(false)
    setDetailId(null)
  }, [queryClient])

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch("/api/stock/export/issues-report")
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `issues-and-variances-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Issues and variances exported")
    } catch {
      toast.error("Failed to export")
    }
  }, [])

  const zoneOptions = zones.map((z: { zoneCode: string; name: string }) => ({
    zoneCode: z.zoneCode,
    name: z.name,
  }))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {session && (
        <StockHeader
          session={session}
          onlineMembers={[]}
        />
      )}

      <CreateIssueSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        zones={zoneOptions}
        sessionId={sessionId ?? null}
        onSuccess={handleIssueSuccess}
      />

      <IssueDetailSheet
        issueId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSuccess={handleIssueSuccess}
      />

      <main className="flex flex-1 flex-col p-4 lg:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Issues</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              Export Excel
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Issue
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by title or description..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0) }}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={classificationFilter} onValueChange={(v) => { setClassificationFilter(v); setPage(0) }}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classifications</SelectItem>
                  {ISSUE_CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {total} issue{total !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {issues.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card py-16">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">No issues yet</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                Log first issue
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/">Back to dashboard</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <IssuesTable
                  issues={issues}
                  total={total}
                  onSelectIssue={handleSelectIssue}
                  onRefresh={handleRefresh}
                  isLoading={isLoading}
                />
              </div>

              <div className="flex flex-col md:hidden">
                {isLoading ? (
                  <div className="space-y-2 rounded-xl border bg-card p-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
                    ))}
                  </div>
                ) : (
                  issues.map((issue) => (
                    <button
                      key={issue.id}
                      type="button"
                      className="flex flex-col gap-1 border-b px-4 py-3 text-left last:border-b-0 transition-colors hover:bg-secondary/30 rounded-xl border bg-card"
                      onClick={() => handleSelectIssue(issue)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium line-clamp-1">{issue.title}</span>
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
                          {issue.reporterName} · {formatDate(issue.createdAt)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {total > limit && (
                <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={(page + 1) * limit >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
