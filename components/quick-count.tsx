"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BarcodeScanner } from "@/components/barcode-scanner"
import type { StockItem } from "@/lib/stock-store"
import {
  Search,
  Minus,
  Plus,
  Check,
  AlertTriangle,
  RotateCcw,
  ScanBarcode,
  X,
  ChevronRight,
  MapPin,
} from "lucide-react"
import { toast } from "sonner"

export function QuickCount({
  items,
  onUpdateCount,
  search,
  onSearchChange,
  location,
  onLocationChange,
  locations = ["All Zones"],
  isLoading,
  sessionStatus = "live",
}: {
  items: StockItem[]
  onUpdateCount: (id: string, qty: number, barcode?: string) => void
  search: string
  onSearchChange: (s: string) => void
  location?: string
  onLocationChange?: (v: string) => void
  locations?: string[]
  isLoading?: boolean
  sessionStatus?: "live" | "paused" | "completed"
}) {
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [countValue, setCountValue] = useState("")
  const [recentCounts, setRecentCounts] = useState<
    Array<{ item: StockItem; qty: number; time: string }>
  >([])
  const [showScanner, setShowScanner] = useState(false)
  const [capturedBarcode, setCapturedBarcode] = useState<string | null>(null)
  const [localSearch, setLocalSearch] = useState(search)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Sync from parent: clear when search cleared; when search set and input empty (e.g. barcode), show it
  useEffect(() => {
    if (search === "") {
      setLocalSearch("")
      if (searchRef.current) searchRef.current.value = ""
    } else if (searchRef.current && searchRef.current.value === "") {
      searchRef.current.value = search
      setLocalSearch(search)
    }
  }, [search])

  const debouncedOnSearchChange = useMemo(() => {
    return (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        onSearchChange(value)
      }, 850)
    }
  }, [onSearchChange])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setLocalSearch(v)
      debouncedOnSearchChange(v)
    },
    [debouncedOnSearchChange]
  )

  const handleSelectItem = useCallback(
    (item: StockItem, preserveBarcode?: boolean) => {
      setSelectedItem(item)
      setCountValue(item.countedQty?.toString() ?? "")
      if (!preserveBarcode) setCapturedBarcode(null)
      onSearchChange("")
      setTimeout(() => inputRef.current?.focus(), 100)
    },
    [onSearchChange]
  )

  const handleSubmitCount = useCallback(() => {
    if (!selectedItem || countValue === "") return
    if (sessionStatus !== "live") {
      toast.error("Counting is disabled when session is paused or completed")
      return
    }
    const qty = parseInt(countValue, 10)
    if (isNaN(qty) || qty < 0) return

    onUpdateCount(selectedItem.id, qty, capturedBarcode ?? undefined)
    setRecentCounts((prev) => [
      {
        item: selectedItem,
        qty,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev.slice(0, 4),
    ])
    setSelectedItem(null)
    setCountValue("")
    setCapturedBarcode(null)
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [selectedItem, countValue, capturedBarcode, onUpdateCount, sessionStatus])

  const adjustCount = (delta: number) => {
    const current = parseInt(countValue, 10) || 0
    const newVal = Math.max(0, current + delta)
    setCountValue(newVal.toString())
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && selectedItem) {
        handleSubmitCount()
      }
      if (e.key === "Escape") {
        setSelectedItem(null)
        setCountValue("")
        onSearchChange("")
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedItem, handleSubmitCount, onSearchChange])

  // Single match from scan: require tap-to-confirm (no auto-select)
  const pendingConfirm =
    showScanner && items.length === 1 && !selectedItem && search?.trim()

  return (
    <div className="flex flex-col rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanBarcode className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Quick Count</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => setShowScanner(!showScanner)}
        >
          <ScanBarcode className="h-3.5 w-3.5" />
          {showScanner ? "Manual" : "Scan"}
        </Button>
      </div>

      {/* Location filter */}
      {locations.length > 1 && onLocationChange && (
        <div className="border-b px-4 py-2">
          <Select value={location ?? "All Zones"} onValueChange={onLocationChange}>
            <SelectTrigger className="h-8 bg-secondary/50 text-xs">
              <MapPin className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc} className="text-xs">
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Search / Scanner input - results in absolute overlay to avoid layout shift (keeps mobile keyboard open) */}
      <div className="border-b px-4 py-3 relative">
        {showScanner && (
          <BarcodeScanner
            active={showScanner}
            onScan={(value) => {
              if (!value?.trim()) return
              onSearchChange(value.trim())
              setTimeout(() => searchRef.current?.focus(), 50)
            }}
            onInvalidBarcode={(_, error) => toast.error(`Invalid barcode: ${error}`)}
            onError={(msg) => {
              if (msg && !msg.includes("No barcode found")) {
                console.warn("Barcode scan error:", msg)
              }
            }}
            className="mb-3"
          />
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            defaultValue=""
            placeholder={
              showScanner
                ? "Scan barcode or enter SKU..."
                : "Search by SKU or product name..."
            }
            onChange={handleSearchInputChange}
            className="min-h-[44px] bg-secondary/50 pl-9 pr-9 text-base md:text-sm touch-manipulation"
            aria-label="Search by SKU or product name"
            data-1p-ignore
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch("")
                onSearchChange("")
                if (searchRef.current) {
                  searchRef.current.value = ""
                  searchRef.current.focus()
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1 text-muted-foreground hover:text-foreground touch-manipulation"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results in absolute overlay - no layout shift so keyboard stays open on mobile */}
        <div className="absolute left-4 right-4 top-full z-50 mt-1">
          {pendingConfirm && (
            <div className="rounded-lg border bg-popover p-3 shadow-lg">
              <p className="text-xs text-muted-foreground">
                Scanned: <span className="font-mono text-foreground">{search.trim()}</span>
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                Match: {items[0]!.name}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => onSearchChange("")}
                >
                  Scan again
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => {
                    setCapturedBarcode(search.trim())
                    handleSelectItem(items[0]!, true)
                  }}
                >
                  <Check className="h-3.5 w-3.5" />
                  Confirm
                </Button>
              </div>
            </div>
          )}
          {search && items.length > 0 && !isLoading && !pendingConfirm && (
          <div className="max-h-48 overflow-y-auto rounded-lg border bg-popover shadow-lg scrollbar-thin">
            {items.slice(0, 8).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-secondary/70 active:bg-secondary/70"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.sku}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.exactBarcodeMatch && (
                    <Badge variant="secondary" className="text-[10px]">
                      Exact match
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      item.status === "pending"
                        ? "border-muted-foreground/30 text-muted-foreground"
                        : item.status === "variance"
                          ? "border-warning/30 text-warning"
                          : item.status === "verified"
                            ? "border-primary/30 text-primary"
                            : "border-chart-2/30 text-chart-2"
                    }`}
                  >
                    {item.status}
                  </Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
          )}
          {search && search.length >= 2 && !isLoading && items.length === 0 && (
            <div className="rounded-lg border bg-popover px-3 py-4 text-center text-sm text-muted-foreground shadow-lg">
              No items found matching &quot;{search}&quot;
            </div>
          )}
          {localSearch.length > 0 && localSearch.length < 2 && (
            <p className="px-1 pt-1 text-xs text-muted-foreground">Type 2+ characters to search</p>
          )}
        </div>
      </div>

      {/* Selected item counting */}
      {selectedItem ? (
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                {selectedItem.name}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {selectedItem.sku} &middot; {selectedItem.location}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setSelectedItem(null)
                setCountValue("")
                setCapturedBarcode(null)
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Expected qty</span>
            <span className="font-mono text-sm font-medium text-foreground">
              {selectedItem.expectedQty}
            </span>
          </div>

          {/* Counter controls */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl bg-transparent"
              onClick={() => adjustCount(-1)}
            >
              <Minus className="h-5 w-5" />
            </Button>
            <Input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              value={countValue}
              onChange={(e) => setCountValue(e.target.value)}
              className="min-h-[48px] bg-secondary/50 text-center font-mono text-xl font-semibold touch-manipulation"
              min={0}
              aria-label="Count quantity"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl bg-transparent"
              onClick={() => adjustCount(1)}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          {/* Variance indicator */}
          {countValue !== "" && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                parseInt(countValue, 10) === selectedItem.expectedQty
                  ? "bg-primary/10 text-primary"
                  : "bg-warning/10 text-warning"
              }`}
            >
              {parseInt(countValue, 10) === selectedItem.expectedQty ? (
                <>
                  <Check className="h-4 w-4" />
                  Count matches expected quantity
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Variance: {parseInt(countValue, 10) - selectedItem.expectedQty > 0 ? "+" : ""}
                  {parseInt(countValue, 10) - selectedItem.expectedQty}
                </>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-transparent"
              onClick={() => {
                setCountValue("")
                inputRef.current?.focus()
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-1.5"
              onClick={handleSubmitCount}
              disabled={countValue === "" || sessionStatus !== "live"}
              title={sessionStatus !== "live" ? "Counting disabled when session is paused or completed" : undefined}
            >
              <Check className="h-3.5 w-3.5" />
              Confirm Count
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <ScanBarcode className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Search or scan an item to begin counting
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Use the search bar above or scan a barcode
          </p>
        </div>
      )}

      {/* Recent counts */}
      {recentCounts.length > 0 && (
        <div className="border-t px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent Counts
          </span>
          <div className="mt-2 flex flex-col gap-1.5">
            {recentCounts.map((entry, i) => (
              <div
                key={`${entry.item.id}-${i}`}
                className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground">
                    {entry.item.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {entry.item.sku}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {entry.qty}
                  </span>
                  {entry.qty === entry.item.expectedQty ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  )}
                  <span className="text-xs text-muted-foreground">{entry.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
