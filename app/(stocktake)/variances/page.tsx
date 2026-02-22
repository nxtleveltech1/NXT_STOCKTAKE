"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { StockHeader } from "@/components/stock-header"
import { StockTable } from "@/components/stock-table"
import { ProductProfileSheet } from "@/components/product-profile-sheet"
import {
  fetchStockItems,
  fetchStockSession,
  fetchExportCsv,
  fetchLocations,
  fetchUoms,
  fetchCategories,
  fetchWarehouses,
  fetchSuppliers,
  fetchCounters,
  verifyStockItem,
} from "@/lib/stock-api"
import type { StockItem } from "@/lib/stock-store"
import type { StockSummary } from "@/lib/stock-api"
import { AlertTriangle, ArrowLeft, Download, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const emptySummary: StockSummary = { total: 0, pending: 0, counted: 0, variance: 0, verified: 0 }

export default function VariancesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)
  const [search, setSearch] = useState("")
  const [zone, setZone] = useState("All Zones")
  const [category, setCategory] = useState("all")
  const [uom, setUom] = useState("all")
  const [warehouse, setWarehouse] = useState("all")
  const [supplier, setSupplier] = useState("all")
  const [countedBy, setCountedBy] = useState("all")
  const [profileItem, setProfileItem] = useState<StockItem | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  const { data: session } = useQuery({
    queryKey: ["stock", "session"],
    queryFn: fetchStockSession,
    refetchInterval: 5_000,
  })

  const { data: locations = ["All Zones"] } = useQuery({
    queryKey: ["stock", "locations"],
    queryFn: fetchLocations,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["stock", "categories"],
    queryFn: fetchCategories,
  })

  const { data: warehouses = [] } = useQuery({
    queryKey: ["stock", "warehouses"],
    queryFn: fetchWarehouses,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ["stock", "suppliers"],
    queryFn: fetchSuppliers,
  })

  const { data: uoms = [] } = useQuery({
    queryKey: ["stock", "uoms"],
    queryFn: fetchUoms,
  })

  const { data: counters = [] } = useQuery({
    queryKey: ["stock", "counters", "variance"],
    queryFn: () => fetchCounters({ status: "variance" }),
  })

  const { data: itemsData, isLoading } = useQuery({
    queryKey: [
      "stock",
      "items",
      "variance",
      page,
      itemsPerPage,
      search,
      zone,
      category,
      uom,
      warehouse,
      supplier,
      countedBy,
    ],
    queryFn: () =>
      fetchStockItems({
        page,
        limit: itemsPerPage,
        status: "variance",
        search: search || undefined,
        location: zone && zone !== "All Zones" ? zone : undefined,
        category: category !== "all" ? category : undefined,
        uom: uom !== "all" ? uom : undefined,
        warehouse: warehouse !== "all" ? warehouse : undefined,
        supplier: supplier !== "all" ? supplier : undefined,
        countedBy: countedBy !== "all" ? countedBy : undefined,
      }),
  })

  const verifyMutation = useMutation({
    mutationFn: (id: string) => verifyStockItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] })
      setProfileOpen(false)
      setProfileItem(null)
      toast.success("Item verified")
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Failed to verify")
    },
  })

  const handleSelectItem = useCallback((item: StockItem) => {
    setProfileItem(item)
    setProfileOpen(true)
  }, [])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stock"] })
  }, [queryClient])

  const handleExportCsv = useCallback(async () => {
    try {
      const blob = await fetchExportCsv({ status: "variance" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `variances-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Variances exported")
    } catch {
      toast.error("Failed to export")
    }
  }, [])

  const handleExportExcel = useCallback(async () => {
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

  const items = itemsData?.items ?? []
  const summary = itemsData?.summary ?? emptySummary
  const filteredTotal = itemsData?.filteredTotal ?? 0
  const total = itemsData?.total ?? 0

  const stockTableProps = {
    items,
    total,
    filteredTotal,
    summary,
    page,
    onPageChange: setPage,
    search,
    onSearchChange: setSearch,
    zone,
    onZoneChange: setZone,
    statusFilter: "variance" as const,
    onStatusFilterChange: () => {},
    categoryFilter: category,
    onCategoryFilterChange: setCategory,
    uomFilter: uom,
    onUomFilterChange: setUom,
    warehouseFilter: warehouse,
    onWarehouseFilterChange: setWarehouse,
    supplierFilter: supplier,
    onSupplierFilterChange: setSupplier,
    countedByFilter: countedBy,
    onCountedByFilterChange: setCountedBy,
    counters,
    locations,
    categories,
    uoms,
    warehouses,
    suppliers,
    onSelectItem: handleSelectItem,
    onVerify: (item: StockItem) => verifyMutation.mutate(item.id),
    sessionStatus: "live" as const,
    onRefresh: handleRefresh,
    isLoading,
    itemsPerPage,
    onItemsPerPageChange: setItemsPerPage,
    hideStatusFilter: true,
    varianceOnlySummary: true,
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {session && (
        <StockHeader
          session={session}
          onlineMembers={[]}
        />
      )}

      <ProductProfileSheet
        item={profileItem}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        locations={locations}
        uoms={uoms}
        suppliers={suppliers}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["stock"] })}
        sessionStatus="live"
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
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h1 className="text-xl font-semibold">Variances</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel
            </Button>
          </div>
        </div>

        {items.length === 0 && !isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border bg-card py-16">
            <AlertTriangle className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No variances</p>
            <Button variant="outline" asChild>
              <Link href="/">Back to dashboard</Link>
            </Button>
          </div>
        ) : (
          <StockTable {...stockTableProps} />
        )}
      </main>
    </div>
  )
}
