"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useOrganization } from "@clerk/nextjs"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { StockHeader } from "@/components/stock-header"
import { SessionStats } from "@/components/session-stats"
import { QuickCount } from "@/components/quick-count"
import { StockTable } from "@/components/stock-table"
import { TeamPanel } from "@/components/team-panel"
import { ActivityFeed } from "@/components/activity-feed"
import { ZoneProgress } from "@/components/zone-progress"
import { ProductProfileSheet } from "@/components/product-profile-sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchStockItems,
  fetchStockSession,
  fetchLocations,
  fetchZones,
  fetchActivity,
  fetchUoms,
  fetchCategories,
  fetchWarehouses,
  updateItemCount,
} from "@/lib/stock-api"
import type { StockItem, TeamMember } from "@/lib/stock-store"
import type { StockSummary } from "@/lib/stock-api"
import {
  LayoutGrid,
  ScanBarcode,
  Table2,
  Users,
  Activity,
} from "lucide-react"

function mapOrgMembersToTeam(memberships: { publicUserData?: { userId?: string; firstName?: string; lastName?: string; identifier?: string }; role: string }[]): TeamMember[] {
  return memberships.map((m, i) => {
    const name =
      m.publicUserData?.firstName && m.publicUserData?.lastName
        ? `${m.publicUserData.firstName} ${m.publicUserData.lastName}`
        : m.publicUserData?.identifier ?? "Member"
    const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    const roleLabel = m.role === "org:admin" ? "Admin" : "Member"
    return {
      id: m.publicUserData?.userId ?? `org-${i}`,
      name,
      avatar: initials,
      role: roleLabel,
      zone: "—",
      itemsCounted: 0,
      status: "active",
      lastActive: "—",
    }
  })
}

const emptySummary: StockSummary = { total: 0, pending: 0, counted: 0, variance: 0, verified: 0 }

export default function StockTakeDashboard() {
  const queryClient = useQueryClient()
  const { memberships } = useOrganization({ memberships: { infinite: true } })
  const teamMembers: TeamMember[] = useMemo(
    () => (memberships?.data?.length ? mapOrgMembersToTeam(memberships.data) : []),
    [memberships?.data]
  )
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const [activeTab, setActiveTab] = useState("dashboard")
  const [itemsPage, setItemsPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)
  const [itemsSearch, setItemsSearch] = useState("")
  const [itemsLocation, setItemsLocation] = useState("All Zones")
  const [itemsStatus, setItemsStatus] = useState("all")
  const [itemsCategory, setItemsCategory] = useState("all")
  const [itemsUom, setItemsUom] = useState("all")
  const [itemsWarehouse, setItemsWarehouse] = useState("all")
  const [countSearch, setCountSearch] = useState("")
  const [countLocation, setCountLocation] = useState("All Zones")
  const [profileItem, setProfileItem] = useState<StockItem | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  const { data: session } = useQuery({
    queryKey: ["stock", "session"],
    queryFn: fetchStockSession,
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

  const { data: zones = [] } = useQuery({
    queryKey: ["stock", "zones"],
    queryFn: fetchZones,
  })

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: [
      "stock",
      "items",
      itemsPage,
      itemsPerPage,
      itemsSearch,
      itemsLocation,
      itemsStatus,
      itemsCategory,
      itemsUom,
      itemsWarehouse,
    ],
    queryFn: () =>
      fetchStockItems({
        page: itemsPage,
        limit: itemsPerPage,
        search: itemsSearch || undefined,
        location:
          itemsLocation && itemsLocation !== "All Zones" ? itemsLocation : undefined,
        status: itemsStatus !== "all" ? itemsStatus : undefined,
        category: itemsCategory !== "all" ? itemsCategory : undefined,
        uom: itemsUom !== "all" ? itemsUom : undefined,
        warehouse: itemsWarehouse !== "all" ? itemsWarehouse : undefined,
      }),
  })

  const { data: countItemsData } = useQuery({
    queryKey: ["stock", "count-items", countSearch, countLocation],
    queryFn: () =>
      fetchStockItems({
        search: countSearch || undefined,
        location:
          countLocation && countLocation !== "All Zones" ? countLocation : undefined,
        limit: 50,
      }),
    enabled: countSearch.length >= 2,
  })

  const { data: activityEvents = [] } = useQuery({
    queryKey: ["stock", "activity"],
    queryFn: () => fetchActivity(50),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  })

  const { data: uoms = [] } = useQuery({
    queryKey: ["stock", "uoms"],
    queryFn: fetchUoms,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      qty,
      barcode,
    }: {
      id: string
      qty: number
      barcode?: string
    }) => updateItemCount(id, qty, barcode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] })
    },
  })

  const handleToggleSession = useCallback(() => {
    // TODO: PATCH session status
  }, [])

  const handleUpdateCount = useCallback(
    (id: string, qty: number, barcode?: string) => {
      updateMutation.mutate({ id, qty, barcode })
    },
    [updateMutation]
  )

  const handleSelectItem = useCallback((item: StockItem) => {
    setProfileItem(item)
    setProfileOpen(true)
  }, [])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stock"] })
  }, [queryClient])

  const items = itemsData?.items ?? []
  const countItems = countItemsData?.items ?? []
  const summary = itemsData?.summary ?? emptySummary
  const filteredTotal = itemsData?.filteredTotal ?? 0

  // Shared StockTable props to avoid duplication
  const stockTableProps = {
    items,
    total: itemsData?.total ?? 0,
    filteredTotal,
    summary,
    page: itemsPage,
    onPageChange: setItemsPage,
    search: itemsSearch,
    onSearchChange: setItemsSearch,
    zone: itemsLocation,
    onZoneChange: setItemsLocation,
    statusFilter: itemsStatus,
    onStatusFilterChange: setItemsStatus,
    categoryFilter: itemsCategory,
    onCategoryFilterChange: setItemsCategory,
    uomFilter: itemsUom,
    onUomFilterChange: setItemsUom,
    warehouseFilter: itemsWarehouse,
    onWarehouseFilterChange: setItemsWarehouse,
    locations,
    categories,
    uoms,
    warehouses,
    onSelectItem: handleSelectItem,
    onRefresh: handleRefresh,
    isLoading: itemsLoading,
    itemsPerPage,
    onItemsPerPageChange: setItemsPerPage,
  }

  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {session && (
          <StockHeader session={session} onToggleSession={handleToggleSession} onlineMembers={teamMembers} />
        )}
        <main className="flex flex-1 items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {session && (
        <StockHeader session={session} onToggleSession={handleToggleSession} onlineMembers={teamMembers} />
      )}

      <ProductProfileSheet
        item={profileItem}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        locations={locations}
        uoms={uoms}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["stock"] })}
      />

      <main className="flex flex-1 flex-col">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col"
        >
          <div className="sticky top-[53px] z-40 border-b bg-card/80 backdrop-blur-xl lg:hidden">
            <TabsList className="flex h-auto w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0">
              <TabsTrigger
                value="dashboard"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="count"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <ScanBarcode className="h-3.5 w-3.5" />
                Count
              </TabsTrigger>
              <TabsTrigger
                value="items"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <Table2 className="h-3.5 w-3.5" />
                Items
              </TabsTrigger>
              <TabsTrigger
                value="team"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <Users className="h-3.5 w-3.5" />
                Team
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <Activity className="h-3.5 w-3.5" />
                Activity
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="flex-1 p-4 lg:hidden">
            <div className="flex flex-col gap-4">
              {session && <SessionStats session={session} />}
              <ZoneProgress zones={zones} />
            </div>
          </TabsContent>

          <TabsContent value="count" className="flex-1 p-4 lg:hidden">
            <QuickCount
              items={countItems}
              onUpdateCount={handleUpdateCount}
              search={countSearch}
              onSearchChange={setCountSearch}
              location={countLocation}
              onLocationChange={setCountLocation}
              locations={locations}
              isLoading={countSearch.length >= 2 && !countItemsData}
            />
          </TabsContent>

          <TabsContent value="items" className="flex-1 p-4 lg:hidden">
            <StockTable {...stockTableProps} />
          </TabsContent>

          <TabsContent value="team" className="flex-1 p-4 lg:hidden">
            <div className="flex flex-col gap-4">
              <TeamPanel members={teamMembers} />
              <ZoneProgress zones={zones} />
            </div>
          </TabsContent>

          <TabsContent value="activity" className="flex-1 p-4 lg:hidden">
            <ActivityFeed events={activityEvents} />
          </TabsContent>

          <div className="hidden flex-1 flex-col gap-4 p-4 lg:flex lg:p-6">
            {session && <SessionStats session={session} />}

            <div className="grid flex-1 grid-cols-12 gap-4">
              <div className="col-span-3 flex flex-col gap-4">
                <QuickCount
                  items={countItems}
                  onUpdateCount={handleUpdateCount}
                  search={countSearch}
                  onSearchChange={setCountSearch}
                  location={countLocation}
                  onLocationChange={setCountLocation}
                  locations={locations}
                  isLoading={countSearch.length >= 2 && !countItemsData}
                />
                <ZoneProgress zones={zones} />
              </div>

              <div className="col-span-6">
                <StockTable {...stockTableProps} />
              </div>

              <div className="col-span-3 flex flex-col gap-4">
                <TeamPanel members={teamMembers} />
                <ActivityFeed events={activityEvents} />
              </div>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  )
}
