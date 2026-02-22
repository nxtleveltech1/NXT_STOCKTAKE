"use client"

import { useState, useMemo, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Download,
  RefreshCw,
  Settings2,
  ArrowUpDown,
} from "lucide-react"
import type { StockIssue } from "@/lib/stock-api"
import { ISSUE_CLASSIFICATIONS } from "@/lib/constants"

type SortField = "title" | "status" | "priority" | "classification" | "zone" | "reporter" | "created"
type SortDir = "asc" | "desc"

export type IssueColumnKey =
  | "title"
  | "status"
  | "priority"
  | "classification"
  | "zone"
  | "reporter"
  | "assignee"
  | "created"
  | "category"
  | "description"

type ColumnDef = {
  key: IssueColumnKey
  label: string
  sortable: boolean
  sortField?: SortField
  defaultVisible: boolean
  minWidth?: string
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Title", sortable: true, sortField: "title", defaultVisible: true, minWidth: "200px" },
  { key: "status", label: "Status", sortable: true, sortField: "status", defaultVisible: true },
  { key: "priority", label: "Priority", sortable: true, sortField: "priority", defaultVisible: true },
  { key: "classification", label: "Classification", sortable: true, sortField: "classification", defaultVisible: true },
  { key: "zone", label: "Zone", sortable: true, sortField: "zone", defaultVisible: true },
  { key: "reporter", label: "Reporter", sortable: true, sortField: "reporter", defaultVisible: true },
  { key: "assignee", label: "Assignee", sortable: false, defaultVisible: true },
  { key: "created", label: "Created", sortable: true, sortField: "created", defaultVisible: true },
  { key: "category", label: "Category", sortable: false, defaultVisible: false },
  { key: "description", label: "Description", sortable: false, defaultVisible: false },
]

const DEFAULT_VISIBLE = new Set(
  ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
)

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

function getClassificationLabel(value: string | null): string {
  if (!value) return "—"
  const found = ISSUE_CLASSIFICATIONS.find((c) => c.value === value)
  return found?.label ?? value
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getCellValue(issue: StockIssue, key: IssueColumnKey): string | number {
  switch (key) {
    case "title":
      return issue.title
    case "status":
      return statusLabels[issue.status] ?? issue.status
    case "priority":
      return issue.priority
    case "classification":
      return getClassificationLabel(issue.classification ?? null)
    case "zone":
      return issue.zone ?? "—"
    case "reporter":
      return issue.reporterName
    case "assignee":
      return issue.assigneeName ?? "—"
    case "created":
      return formatDate(issue.createdAt)
    case "category":
      return issue.category ?? "—"
    case "description":
      return issue.description ?? "—"
    default:
      return "—"
  }
}

export type IssuesTableProps = {
  issues: StockIssue[]
  total: number
  onSelectIssue: (issue: StockIssue) => void
  onRefresh: () => void
  isLoading?: boolean
}

export function IssuesTable({
  issues,
  total,
  onSelectIssue,
  onRefresh,
  isLoading = false,
}: IssuesTableProps) {
  const [sortField, setSortField] = useState<SortField>("created")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [visibleColumns, setVisibleColumns] = useState<Set<IssueColumnKey>>(
    () => new Set(DEFAULT_VISIBLE)
  )

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir("asc")
      return field
    })
  }, [])

  const sorted = useMemo(() => {
    const arr = [...issues]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title)
          break
        case "status":
          cmp = (statusLabels[a.status] ?? a.status).localeCompare(statusLabels[b.status] ?? b.status)
          break
        case "priority":
          cmp = ["low", "medium", "high", "critical"].indexOf(a.priority) - ["low", "medium", "high", "critical"].indexOf(b.priority)
          break
        case "classification":
          cmp = (getClassificationLabel(a.classification ?? null)).localeCompare(getClassificationLabel(b.classification ?? null))
          break
        case "zone":
          cmp = (a.zone ?? "").localeCompare(b.zone ?? "")
          break
        case "reporter":
          cmp = a.reporterName.localeCompare(b.reporterName)
          break
        case "created":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        default:
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [issues, sortField, sortDir])

  const toggleColumn = useCallback((key: IssueColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const resetColumns = useCallback(() => {
    setVisibleColumns(new Set(DEFAULT_VISIBLE))
  }, [])

  const visibleColumnDefs = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleColumns.has(c.key)),
    [visibleColumns]
  )

  const exportCSV = useCallback(() => {
    const headers = visibleColumnDefs.map((c) => c.label)
    const rows = sorted.map((issue) =>
      visibleColumnDefs.map((col) => {
        const val = getCellValue(issue, col.key)
        return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : String(val ?? "")
      })
    )
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `issues-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [sorted, visibleColumnDefs])

  if (isLoading) {
    return (
      <div className="flex flex-col rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={200}>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground">
                      <Settings2 className="h-3.5 w-3.5" />
                      Manage Columns
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Show or hide table columns</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALL_COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.size === ALL_COLUMNS.length}
                  onCheckedChange={() => {
                    if (visibleColumns.size === ALL_COLUMNS.length) {
                      resetColumns()
                    } else {
                      setVisibleColumns(new Set(ALL_COLUMNS.map((c) => c.key)))
                    }
                  }}
                >
                  Show all
                </DropdownMenuCheckboxItem>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={resetColumns}
                >
                  Reset to default
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={onRefresh}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Refresh data</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={exportCSV}>
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export visible columns as CSV</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {total.toLocaleString("en-US")} issue{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {visibleColumnDefs.map((col) => (
                <TableHead
                  key={col.key}
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                >
                  {col.sortable && col.sortField ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs"
                      onClick={() => toggleSort(col.sortField!)}
                    >
                      {col.label}
                      <ArrowUpDown
                        className={`h-3 w-3 ${sortField === col.sortField ? "text-foreground" : "text-muted-foreground/50"}`}
                      />
                    </button>
                  ) : (
                    <span className="text-xs">{col.label}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnDefs.length} className="h-32 text-center text-sm text-muted-foreground">
                  No issues found
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((issue) => (
                <TableRow
                  key={issue.id}
                  className="cursor-pointer transition-colors hover:bg-secondary/50"
                  onClick={() => onSelectIssue(issue)}
                >
                  {visibleColumnDefs.map((col) => (
                    <TableCell key={col.key} className="max-w-[200px] truncate">
                      {col.key === "status" ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {getCellValue(issue, col.key) as string}
                        </Badge>
                      ) : col.key === "priority" ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${priorityColors[issue.priority] ?? ""}`}
                        >
                          {getCellValue(issue, col.key) as string}
                        </Badge>
                      ) : (
                        String(getCellValue(issue, col.key))
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
