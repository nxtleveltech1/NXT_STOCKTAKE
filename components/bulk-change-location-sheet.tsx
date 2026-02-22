"use client"

import { useState, useMemo } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { bulkUpdateStockItems } from "@/lib/stock-api"
import { getLocationDisplayName } from "@/lib/locations"
import { MapPin } from "lucide-react"
import { toast } from "sonner"

type BulkChangeLocationSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ids: string[]
  locations: string[]
  onSuccess: () => void
  onClearSelection: () => void
}

export function BulkChangeLocationSheet({
  open,
  onOpenChange,
  ids,
  locations,
  onSuccess,
  onClearSelection,
}: BulkChangeLocationSheetProps) {
  const [location, setLocation] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const assignableLocations = useMemo(
    () => locations.filter((l) => l !== "All Zones"),
    [locations]
  )

  const handleSubmit = async () => {
    if (!location.trim()) {
      toast.error("Select a location")
      return
    }
    setIsSubmitting(true)
    try {
      const { updated } = await bulkUpdateStockItems(ids, { location: location.trim() })
      toast.success(`Updated ${updated} item${updated !== 1 ? "s" : ""}`)
      onSuccess()
      onClearSelection()
      onOpenChange(false)
      setLocation("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Change location
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Update location for {ids.length} selected item{ids.length !== 1 ? "s" : ""}.
          </p>
          <div className="space-y-2">
            <Label htmlFor="bulk-location">New location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger id="bulk-location" className="w-full">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {assignableLocations.map((loc) => (
                  <SelectItem key={loc} value={loc} className="text-sm">
                    {getLocationDisplayName(loc)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !location}
              className="flex-1"
            >
              {isSubmitting ? "Updating…" : `Apply to ${ids.length} items`}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
