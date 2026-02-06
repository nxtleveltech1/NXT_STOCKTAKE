"use client"

import { useState, useRef, useCallback, useEffect } from "react"
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

export function QuickCount({
  items,
  onUpdateCount,
  search,
  onSearchChange,
  location,
  onLocationChange,
  locations = ["All Zones"],
  isLoading,
}: {
  items: StockItem[]
  onUpdateCount: (id: string, qty: number, barcode?: string) => void
  search: string
  onSearchChange: (s: string) => void
  location?: string
  onLocationChange?: (v: string) => void
  locations?: string[]
  isLoading?: boolean
}) {
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [countValue, setCountValue] = useState("")
  const [recentCounts, setRecentCounts] = useState<
    Array<{ item: StockItem; qty: number; time: string }>
  >([])
  const [showScanner, setShowScanner] = useState(false)
  const [scanToCountActive, setScanToCountActive] = useState(false)
  const [capturedBarcode, setCapturedBarcode] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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
    setScanToCountActive(false)
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [selectedItem, countValue, capturedBarcode, onUpdateCount])

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

  // Auto-select when scan/search returns exactly one match
  useEffect(() => {
    if (showScanner && items.length === 1 && !selectedItem && search) {
      setCapturedBarcode(search.trim())
      handleSelectItem(items[0], true)
    }
  }, [showScanner, items, selectedItem, search, handleSelectItem])

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

      {/* Search / Scanner input */}
      <div className="border-b px-4 py-3">
        {showScanner && (
          <BarcodeScanner
            active={showScanner}
            onScan={(value) => {
              if (!value?.trim()) return
              onSearchChange(value.trim())
              setTimeout(() => searchRef.current?.focus(), 50)
            }}
            onError={(msg) => {
              if (msg && !msg.includes("No barcode found")) {
                console.warn("Barcode scan error:", msg)
              }
            }}
            className="mb-3"
          />
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder={
              showScanner
                ? "Scan barcode or enter SKU..."
                : "Search by SKU or product name..."
            }
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 bg-secondary/50 pl-9 pr-8 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {search && items.length > 0 && !isLoading && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border bg-popover scrollbar-thin">
            {items.slice(0, 8).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-secondary/70"
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
          <div className="mt-2 rounded-lg border bg-popover px-3 py-4 text-center text-sm text-muted-foreground">
            No items found matching &quot;{search}&quot;
          </div>
        )}
        {search && search.length < 2 && (
          <p className="mt-2 text-xs text-muted-foreground">Type 2+ characters to search</p>
        )}
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
                setScanToCountActive(false)
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
              value={countValue}
              onChange={(e) => setCountValue(e.target.value)}
              className="h-12 bg-secondary/50 text-center font-mono text-xl font-semibold"
              min={0}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl bg-transparent"
              onClick={() => adjustCount(1)}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button
              variant={scanToCountActive ? "default" : "outline"}
              size="sm"
              className="h-12 shrink-0 gap-1.5 rounded-xl px-3"
              onClick={() => {
                setScanToCountActive((prev) => !prev)
                if (scanToCountActive) return
                setTimeout(() => inputRef.current?.blur(), 50)
              }}
            >
              <ScanBarcode className="h-4 w-4" />
              Scan
            </Button>
          </div>

          {/* Scan-to-count: each barcode scan adds 1 */}
          {scanToCountActive && (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Scan each unit to add 1 to the count
              </p>
              <BarcodeScanner
                active={scanToCountActive}
                onScan={(value) => {
                  setCapturedBarcode((prev) => prev ?? value)
                  setCountValue((prev) => {
                    const current = parseInt(prev, 10) || 0
                    return (current + 1).toString()
                  })
                }}
                onError={(msg) => {
                  if (msg && !msg.includes("No barcode found")) {
                    console.warn("Barcode scan error:", msg)
                  }
                }}
              />
            </div>
          )}

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
              disabled={countValue === ""}
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
