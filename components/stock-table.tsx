"use client"

import { useState, useMemo, useEffect, useRef } from "react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import type { StockItem } from "@/lib/stock-store"
import {
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

type SortField = "name" | "sku" | "variance" | "status"
type SortDir = "asc" | "desc"

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "border-muted-foreground/30 text-muted-foreground bg-muted-foreground/5",
  },
  counted: {
    label: "Counted",
    icon: CheckCircle2,
    className: "border-chart-2/30 text-chart-2 bg-chart-2/5",
  },
  variance: {
    label: "Variance",
    icon: AlertTriangle,
    className: "border-warning/30 text-warning bg-warning/5",
  },
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    className: "border-primary/30 text-primary bg-primary/5",
  },
} as const

const ITEMS_PER_PAGE = 100

export function StockTable({
  items,
  total,
  page,
  onPageChange,
  search,
  onSearchChange,
  zone,
  onZoneChange,
  statusFilter,
  onStatusFilterChange,
  locations,
  onSelectItem,
  isLoading,
}: {
  items: StockItem[]
  total: number
  page: number
  onPageChange: (p: number) => void
  search: string
  onSearchChange: (s: string) => void
  zone: string
  onZoneChange: (z: string) => void
  statusFilter: string
  onStatusFilterChange: (s: string) => void
  locations: string[]
  onSelectItem: (item: StockItem) => void
  isLoading?: boolean
}) {
  const [sortField, setSortField] = useState<SortField>("status")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (search === "") setLocalSearch("")
  }, [search])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      onSearchChange(value)
      onPageChange(1)
    }, 850)
  }

  const sorted = useMemo(() => {
    const statusOrder = { pending: 0, variance: 1, counted: 2, verified: 3 }
    const arr = [...items]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "sku":
          cmp = a.sku.localeCompare(b.sku)
          break
        case "variance":
          cmp = (a.variance ?? 0) - (b.variance ?? 0)
          break
        case "status":
          cmp = statusOrder[a.status] - statusOrder[b.status]
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [items, sortField, sortDir])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Stock Items</h2>
          <Badge variant="secondary" className="font-mono text-xs">
            {total.toLocaleString('en-US')}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs lg:hidden"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
        </Button>
      </div>

      <div className="border-b px-4 py-3">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Search items, SKUs, locations..."
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="min-h-[44px] bg-secondary/50 pl-9 text-base md:text-sm touch-manipulation"
              aria-label="Search items, SKUs, locations"
            />
          </div>

          <div className={`flex-wrap gap-2 ${filtersOpen ? "flex" : "hidden lg:flex"}`}>
            <Select value={zone} onValueChange={(v) => { onZoneChange(v); onPageChange(1) }}>
              <SelectTrigger className="h-8 w-auto min-w-[140px] bg-secondary/50 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((z) => (
                  <SelectItem key={z} value={z} className="text-xs">
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => { onStatusFilterChange(v); onPageChange(1) }}
            >
              <SelectTrigger className="h-8 w-auto min-w-[100px] bg-secondary/50 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["all", "pending", "counted", "variance", "verified"] as const).map(
                  (s) => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">
                      {s}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">
                <button type="button" className="flex items-center gap-1 text-xs" onClick={() => toggleSort("sku")}>
                  SKU <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="flex items-center gap-1 text-xs" onClick={() => toggleSort("name")}>
                  Product <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-xs">Location</TableHead>
              <TableHead className="text-xs">Barcode</TableHead>
              <TableHead className="text-xs">UOM</TableHead>
              <TableHead className="text-right text-xs">Expected</TableHead>
              <TableHead className="text-right text-xs">Counted</TableHead>
              <TableHead className="text-right">
                <button type="button" className="ml-auto flex items-center gap-1 text-xs" onClick={() => toggleSort("variance")}>
                  Variance <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="flex items-center gap-1 text-xs" onClick={() => toggleSort("status")}>
                  Status <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead className="text-xs">Counted By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => {
              const sc = statusConfig[item.status]
              const StatusIcon = sc.icon
              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer transition-colors hover:bg-secondary/50"
                  onClick={() => onSelectItem(item)}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">{item.sku}</TableCell>
                  <TableCell className="text-sm font-medium text-foreground">{item.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.location}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.barcode ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.uom ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">{item.expectedQty.toLocaleString('en-US')}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-foreground">
                    {item.countedQty != null ? item.countedQty.toLocaleString('en-US') : <span className="text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.variance !== null ? (
                      <span className={`font-mono text-sm font-medium ${item.variance === 0 ? "text-primary" : item.variance > 0 ? "text-warning" : "text-destructive"}`}>
                        {item.variance > 0 ? "+" : ""}{item.variance}
                      </span>
                    ) : (
                      <span className="font-mono text-sm text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 text-xs ${sc.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {sc.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.lastCountedBy ? (
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground">{item.lastCountedBy}</span>
                        <span className="text-xs text-muted-foreground">{item.lastCountedAt}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">--</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col lg:hidden">
        {sorted.map((item) => {
          const sc = statusConfig[item.status]
          const StatusIcon = sc.icon
          return (
            <button
              key={item.id}
              type="button"
              className="flex flex-col gap-2 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-secondary/50"
              onClick={() => onSelectItem(item)}
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                </div>
                <Badge variant="outline" className={`gap-1 text-xs ${sc.className}`}>
                  <StatusIcon className="h-3 w-3" />
                  {sc.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{item.location}</span>
                {item.barcode && (
                  <span className="font-mono">Barcode: {item.barcode}</span>
                )}
                {item.uom && (
                  <span>UOM: {item.uom}</span>
                )}
                <span className="flex items-center gap-1">Exp: <span className="font-mono text-foreground">{item.expectedQty.toLocaleString('en-US')}</span></span>
                <span className="flex items-center gap-1">Cnt: <span className="font-mono text-foreground">{item.countedQty != null ? item.countedQty.toLocaleString('en-US') : "--"}</span></span>
                {item.variance !== null && (
                  <span className={`font-mono font-medium ${item.variance === 0 ? "text-primary" : item.variance > 0 ? "text-warning" : "text-destructive"}`}>
                    {item.variance > 0 ? "+" : ""}{item.variance}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-2.5">
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
