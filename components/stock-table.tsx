"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import type { StockItem } from "@/lib/stock-store"
import { getLocationDisplayName } from "@/lib/locations"
import type { StockSummary } from "@/lib/stock-api"
import {
  Search,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Settings2,
  Package,
  PackageCheck,
  PackageX,
  PackageSearch,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = "name" | "sku" | "variance" | "status" | "expectedQty" | "countedQty" | "location" | "category" | "uom" | "warehouse"
type SortDir = "asc" | "desc"

export type ColumnKey =
  | "sku"
  | "name"
  | "supplier"
  | "category"
  | "location"
  | "warehouse"
  | "barcode"
  | "uom"
  | "expectedQty"
  | "reservedQty"
  | "availableQty"
  | "countedQty"
  | "variance"
  | "status"
  | "lastCountedBy"
  | "serialNumber"
  | "owner"
  | "costPrice"
  | "listPrice"

type ColumnDef = {
  key: ColumnKey
  label: string
  sortable: boolean
  sortField?: SortField
  align?: "left" | "right" | "center"
  defaultVisible: boolean
  minWidth?: string
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "supplier", label: "Supplier", sortable: true, sortField: "name", defaultVisible: true, minWidth: "140px" },
  { key: "sku", label: "SKU", sortable: true, sortField: "sku", defaultVisible: true, minWidth: "100px" },
  { key: "name", label: "Product Name", sortable: true, sortField: "name", defaultVisible: true, minWidth: "200px" },
  { key: "category", label: "Category", sortable: true, sortField: "category", defaultVisible: false },
  { key: "location", label: "Location", sortable: true, sortField: "location", defaultVisible: true },
  { key: "warehouse", label: "Warehouse", sortable: true, sortField: "warehouse", defaultVisible: false },
  { key: "barcode", label: "Barcode", sortable: false, defaultVisible: false },
  { key: "uom", label: "UOM", sortable: true, sortField: "uom", defaultVisible: true },
  { key: "expectedQty", label: "Expected", sortable: true, sortField: "expectedQty", align: "right", defaultVisible: true },
  { key: "reservedQty", label: "Reserved", sortable: false, align: "right", defaultVisible: false },
  { key: "availableQty", label: "Available", sortable: false, align: "right", defaultVisible: false },
  { key: "countedQty", label: "Counted", sortable: true, sortField: "countedQty", align: "right", defaultVisible: true },
  { key: "variance", label: "Variance", sortable: true, sortField: "variance", align: "right", defaultVisible: true },
  { key: "costPrice", label: "Cost Price", sortable: false, align: "right", defaultVisible: false },
  { key: "listPrice", label: "List Price", sortable: false, align: "right", defaultVisible: false },
  { key: "status", label: "Status", sortable: true, sortField: "status", defaultVisible: true },
  { key: "lastCountedBy", label: "Counted By", sortable: false, defaultVisible: true },
  { key: "serialNumber", label: "Serial Number", sortable: false, defaultVisible: false },
  { key: "owner", label: "Owner", sortable: false, defaultVisible: false },
]

const DEFAULT_VISIBLE = new Set(
  ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)
)

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type StockTableProps = {
  items: StockItem[]
  total: number
  filteredTotal: number
  summary: StockSummary
  page: number
  onPageChange: (p: number) => void
  search: string
  onSearchChange: (s: string) => void
  zone: string
  onZoneChange: (z: string) => void
  statusFilter: string
  onStatusFilterChange: (s: string) => void
  categoryFilter: string
  onCategoryFilterChange: (c: string) => void
  uomFilter: string
  onUomFilterChange: (u: string) => void
  warehouseFilter: string
  onWarehouseFilterChange: (w: string) => void
  supplierFilter: string
  onSupplierFilterChange: (s: string) => void
  countedByFilter?: string
  onCountedByFilterChange?: (v: string) => void
  counters?: string[]
  locations: string[]
  categories: string[]
  uoms: string[]
  warehouses: string[]
  suppliers: string[]
  onSelectItem: (item: StockItem) => void
  onVerify?: (item: StockItem) => void
  sessionStatus?: "live" | "paused" | "completed"
  onRefresh: () => void
  /** When true, hide the status filter (e.g. on variances-only page) */
  hideStatusFilter?: boolean
  /** When true, show only variance summary card and hide others */
  varianceOnlySummary?: boolean
  isLoading?: boolean
  itemsPerPage: number
  onItemsPerPageChange: (n: number) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StockTable({
  items,
  total,
  filteredTotal,
  summary,
  page,
  onPageChange,
  search,
  onSearchChange,
  zone,
  onZoneChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  uomFilter,
  onUomFilterChange,
  warehouseFilter,
  onWarehouseFilterChange,
  supplierFilter,
  onSupplierFilterChange,
  countedByFilter = "all",
  onCountedByFilterChange,
  counters = [],
  locations,
  categories,
  uoms,
  warehouses,
  suppliers,
  onSelectItem,
  onVerify,
  sessionStatus = "live",
  onRefresh,
  isLoading,
  itemsPerPage,
  onItemsPerPageChange,
  hideStatusFilter = false,
  varianceOnlySummary = false,
}: StockTableProps) {
  const [sortField, setSortField] = useState<SortField>("status")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [localSearch, setLocalSearch] = useState(search)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(DEFAULT_VISIBLE)
  )
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
    }, 600)
  }

  const resetPage = useCallback(() => onPageChange(1), [onPageChange])

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
        case "expectedQty":
          cmp = a.expectedQty - b.expectedQty
          break
        case "countedQty":
          cmp = (a.countedQty ?? 0) - (b.countedQty ?? 0)
          break
        case "location":
          cmp = a.location.localeCompare(b.location)
          break
        case "category":
          cmp = (a.category ?? "").localeCompare(b.category ?? "")
          break
        case "uom":
          cmp = (a.uom ?? "").localeCompare(b.uom ?? "")
          break
        case "warehouse":
          cmp = (a.warehouse ?? "").localeCompare(b.warehouse ?? "")
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [items, sortField, sortDir])

  const totalPages = Math.ceil(filteredTotal / itemsPerPage) || 1

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function resetColumns() {
    setVisibleColumns(new Set(DEFAULT_VISIBLE))
  }

  const visibleColumnDefs = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleColumns.has(c.key)),
    [visibleColumns]
  )

  // CSV export
  const exportCSV = useCallback(() => {
    const headers = visibleColumnDefs.map((c) => c.label)
    const rows = sorted.map((item) =>
      visibleColumnDefs.map((col) => {
        const val = getCellValue(item, col.key)
        return typeof val === "string" ? `"${val.replace(/"/g, '""')}"` : String(val ?? "")
      })
    )
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stock-items-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [sorted, visibleColumnDefs])

  const activeFilterCount = [
    zone !== "All Zones" ? 1 : 0,
    !hideStatusFilter && statusFilter !== "all" ? 1 : 0,
    categoryFilter !== "all" ? 1 : 0,
    uomFilter !== "all" ? 1 : 0,
    warehouseFilter !== "all" ? 1 : 0,
    supplierFilter !== "all" ? 1 : 0,
    countedByFilter !== "all" ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

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
    <div className="flex flex-col gap-4">
      {/* Summary stat cards - hidden on mobile */}
      <div className={`hidden lg:grid gap-3 ${varianceOnlySummary ? "grid-cols-1 max-w-xs" : "grid-cols-5"}`}>
        {varianceOnlySummary ? (
          <SummaryCard
            label="VARIANCES"
            value={summary.variance}
            icon={<PackageX className="h-4 w-4" />}
            accent="warning"
          />
        ) : (
          <>
            <SummaryCard
              label="TOTAL ITEMS"
              value={summary.total}
              icon={<Package className="h-4 w-4" />}
            />
            <SummaryCard
              label="PENDING"
              value={summary.pending}
              icon={<PackageSearch className="h-4 w-4" />}
              accent="muted"
            />
            <SummaryCard
              label="COUNTED"
              value={summary.counted}
              icon={<PackageCheck className="h-4 w-4" />}
              accent="success"
            />
            <SummaryCard
              label="VARIANCES"
              value={summary.variance}
              icon={<PackageX className="h-4 w-4" />}
              accent="warning"
            />
            <SummaryCard
              label="VERIFIED"
              value={summary.verified}
              icon={<ShieldCheck className="h-4 w-4" />}
              accent="primary"
            />
          </>
        )}
      </div>

      {/* Main table card */}
      <div className="flex flex-col rounded-xl border bg-card">
        {/* Search bar */}
        <div className="border-b px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Search by name or SKU"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="min-h-[44px] bg-secondary/50 pl-9 text-base md:text-sm touch-manipulation"
              aria-label="Search by name or SKU"
            />
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <FilterSelect
            value={supplierFilter}
            onValueChange={(v) => { onSupplierFilterChange(v); resetPage() }}
            placeholder="All suppliers"
            options={["all", ...suppliers]}
            formatLabel={(v) => v === "all" ? "All suppliers" : v}
          />
          <FilterSelect
            value={zone}
            onValueChange={(v) => { onZoneChange(v); resetPage() }}
            placeholder="All Zones"
            options={locations}
            formatLabel={(v) => getLocationDisplayName(v)}
          />
          <FilterSelect
            value={categoryFilter}
            onValueChange={(v) => { onCategoryFilterChange(v); resetPage() }}
            placeholder="All categories"
            options={["all", ...categories]}
            formatLabel={(v) => v === "all" ? "All categories" : v}
          />
          <FilterSelect
            value={uomFilter}
            onValueChange={(v) => { onUomFilterChange(v); resetPage() }}
            placeholder="All UOMs"
            options={["all", ...uoms]}
            formatLabel={(v) => v === "all" ? "All UOMs" : v}
          />
          <FilterSelect
            value={warehouseFilter}
            onValueChange={(v) => { onWarehouseFilterChange(v); resetPage() }}
            placeholder="All warehouses"
            options={["all", ...warehouses]}
            formatLabel={(v) => v === "all" ? "All warehouses" : v}
          />
          {counters.length > 0 && onCountedByFilterChange && (
            <FilterSelect
              value={countedByFilter}
              onValueChange={(v) => { onCountedByFilterChange(v); resetPage() }}
              placeholder="All counted by"
              options={["all", ...counters]}
              formatLabel={(v) => v === "all" ? "All counted by" : v}
            />
          )}
          {!hideStatusFilter && (
            <FilterSelect
              value={statusFilter}
              onValueChange={(v) => { onStatusFilterChange(v); resetPage() }}
              placeholder="All statuses"
              options={["all", "pending", "counted", "variance", "verified"]}
              formatLabel={(v) => v === "all" ? "All statuses" : v.charAt(0).toUpperCase() + v.slice(1)}
            />
          )}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                onZoneChange("All Zones")
                if (!hideStatusFilter) onStatusFilterChange("all")
                onCategoryFilterChange("all")
                onUomFilterChange("all")
                onWarehouseFilterChange("all")
                onSupplierFilterChange("all")
                onCountedByFilterChange?.("all")
                resetPage()
              }}
            >
              Clear filters ({activeFilterCount})
            </Button>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={200}>
              {/* Manage Columns */}
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

              {/* Refresh */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground" onClick={onRefresh}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Refresh data</TooltipContent>
              </Tooltip>

              {/* Export CSV */}
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
            {filteredTotal.toLocaleString("en-US")} Items
          </span>
        </div>

        {/* Desktop table */}
        <TooltipProvider delayDuration={200}>
        <div className="hidden overflow-x-auto lg:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {visibleColumnDefs.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.align === "right" ? "text-right" : ""}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                  >
                    {col.sortable && col.sortField ? (
                      <button
                        type="button"
                        className={`flex items-center gap-1 text-xs ${col.align === "right" ? "ml-auto" : ""}`}
                        onClick={() => toggleSort(col.sortField!)}
                      >
                        {col.label}
                        <ArrowUpDown className={`h-3 w-3 ${sortField === col.sortField ? "text-foreground" : "text-muted-foreground/50"}`} />
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
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer transition-colors hover:bg-secondary/50"
                    onClick={() => onSelectItem(item)}
                  >
                    {visibleColumnDefs.map((col) => (
                      <TableCell
                        key={col.key}
                        className={col.align === "right" ? "text-right" : ""}
                      >
                        <CellRenderer
                          item={item}
                          columnKey={col.key}
                          onVerify={onVerify}
                          sessionStatus={sessionStatus}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>

        {/* Mobile card view */}
        <div className="flex flex-col lg:hidden">
          {sorted.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No items found
            </div>
          ) : (
            sorted.map((item) => {
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
                    <span>{getLocationDisplayName(item.location)}</span>
                    {item.category && <span>{item.category}</span>}
                    {item.barcode && <span className="font-mono">BC: {item.barcode}</span>}
                    {item.uom && <span>UOM: {item.uom}</span>}
                    <span className="flex items-center gap-1">Exp: <span className="font-mono text-foreground">{item.expectedQty.toLocaleString("en-US")}</span></span>
                    <span className="flex items-center gap-1">Cnt: <span className="font-mono text-foreground">{item.countedQty != null ? item.countedQty.toLocaleString("en-US") : "--"}</span></span>
                    {item.variance !== null && (
                      <span className={`font-mono font-medium ${item.variance === 0 ? "text-primary" : item.variance > 0 ? "text-warning" : "text-destructive"}`}>
                        {item.variance > 0 ? "+" : ""}{item.variance}
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Rows:</span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(v) => {
                  onItemsPerPageChange(Number(v))
                  onPageChange(1)
                }}
              >
                <SelectTrigger className="h-7 w-[70px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[50, 100, 200, 500].map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPageChange(1)}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function getCellValue(item: StockItem, key: ColumnKey): string | number | null {
  switch (key) {
    case "sku": return item.sku
    case "name": return item.name
    case "category": return item.category || ""
    case "location": return item.location
    case "warehouse": return item.warehouse || ""
    case "barcode": return item.barcode
    case "uom": return item.uom
    case "expectedQty": return item.expectedQty
    case "reservedQty": return item.reservedQty
    case "availableQty": return item.availableQty
    case "countedQty": return item.countedQty
    case "variance": return item.variance
    case "status": return item.status
    case "lastCountedBy": return item.lastCountedBy
    case "serialNumber": return item.serialNumber
    case "owner": return item.owner
    case "supplier": return item.supplier
    case "costPrice": return item.costPrice
    case "listPrice": return item.listPrice
    default: return null
  }
}

function CellRenderer({
  item,
  columnKey,
  onVerify,
  sessionStatus = "live",
}: {
  item: StockItem
  columnKey: ColumnKey
  onVerify?: (item: StockItem) => void
  sessionStatus?: "live" | "paused" | "completed"
}) {
  switch (columnKey) {
    case "sku":
      return <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
    case "name":
      return <span className="text-sm font-medium text-foreground">{item.name}</span>
    case "category":
      return <span className="text-xs text-muted-foreground">{item.category || "—"}</span>
    case "location":
      return <span className="text-xs text-muted-foreground">{getLocationDisplayName(item.location)}</span>
    case "warehouse":
      return <span className="text-xs text-muted-foreground">{item.warehouse || "—"}</span>
    case "barcode":
      return <span className="font-mono text-xs text-muted-foreground">{item.barcode ?? "—"}</span>
    case "uom":
      return <span className="text-xs text-muted-foreground">{item.uom ?? "—"}</span>
    case "expectedQty":
      return <span className="font-mono text-sm text-foreground">{item.expectedQty.toLocaleString("en-US")}</span>
    case "reservedQty":
      return <span className="font-mono text-sm text-muted-foreground">{item.reservedQty.toLocaleString("en-US")}</span>
    case "availableQty":
      return <span className="font-mono text-sm text-muted-foreground">{item.availableQty.toLocaleString("en-US")}</span>
    case "countedQty":
      return item.countedQty != null
        ? <span className="font-mono text-sm text-foreground">{item.countedQty.toLocaleString("en-US")}</span>
        : <span className="text-muted-foreground">--</span>
    case "variance":
      if (item.variance !== null) {
        const color = item.variance === 0 ? "text-primary" : item.variance > 0 ? "text-warning" : "text-destructive"
        return (
          <span className={`font-mono text-sm font-medium ${color}`}>
            {item.variance > 0 ? "+" : ""}{item.variance}
          </span>
        )
      }
      return <span className="font-mono text-sm text-muted-foreground">--</span>
    case "status": {
      const sc = statusConfig[item.status]
      const StatusIcon = sc.icon
      const canVerify = item.status === "variance" && onVerify && sessionStatus === "live"
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Badge variant="outline" className={`gap-1 text-xs ${sc.className}`}>
            <StatusIcon className="h-3 w-3" />
            {sc.label}
          </Badge>
          {canVerify && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    onVerify(item)
                  }}
                >
                  <ShieldCheck className="h-3 w-3 text-muted-foreground hover:text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Verify</TooltipContent>
            </Tooltip>
          )}
        </div>
      )
    }
    case "lastCountedBy":
      return item.lastCountedBy ? (
        <div className="flex flex-col">
          <span className="text-xs text-foreground">{item.lastCountedBy}</span>
          <span className="text-xs text-muted-foreground">{item.lastCountedAt}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">--</span>
      )
    case "serialNumber":
      return <span className="font-mono text-xs text-muted-foreground">{item.serialNumber ?? "—"}</span>
    case "owner":
      return <span className="text-xs text-muted-foreground">{item.owner ?? "—"}</span>
    case "supplier":
      return <span className="text-xs text-muted-foreground">{item.supplier ?? "—"}</span>
    case "costPrice":
      return item.costPrice != null
        ? <span className="font-mono text-xs text-muted-foreground">{item.costPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        : <span className="text-xs text-muted-foreground">—</span>
    case "listPrice":
      return item.listPrice != null
        ? <span className="font-mono text-xs text-muted-foreground">{item.listPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        : <span className="text-xs text-muted-foreground">—</span>
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent?: "muted" | "success" | "warning" | "primary"
}) {
  const accentStyles = {
    muted: "text-muted-foreground",
    success: "text-chart-2",
    warning: "text-warning",
    primary: "text-primary",
  }
  const iconColor = accent ? accentStyles[accent] : "text-foreground"

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/50 ${iconColor}`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {value.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter Select (reusable)
// ---------------------------------------------------------------------------

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
  formatLabel,
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder: string
  options: string[]
  formatLabel?: (v: string) => string
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-auto min-w-[130px] bg-secondary/50 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt} className="text-xs">
            {formatLabel ? formatLabel(opt) : opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
