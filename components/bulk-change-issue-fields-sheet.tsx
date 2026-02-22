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
import { bulkUpdateIssues } from "@/lib/stock-api"
import { getLocationDisplayName } from "@/lib/locations"
import { MapPin, Tag } from "lucide-react"
import { toast } from "sonner"

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const

type ZoneOption = { zoneCode: string; name: string }

type BulkChangeIssueFieldsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  ids: string[]
  zones: ZoneOption[]
  assignees: { id: string; name: string }[]
  onSuccess: () => void
  onClearSelection: () => void
}

export function BulkChangeIssueFieldsSheet({
  open,
  onOpenChange,
  ids,
  zones,
  assignees,
  onSuccess,
  onClearSelection,
}: BulkChangeIssueFieldsSheetProps) {
  const [zone, setZone] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [priority, setPriority] = useState<string | null>(null)
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const zoneOptions = useMemo(
    () => zones.map((z) => ({ value: z.zoneCode, label: getLocationDisplayName(z.zoneCode) })),
    [zones]
  )

  const hasChange =
    (zone !== null && zone !== "") ||
    status !== null ||
    priority !== null ||
    assigneeId !== null

  const handleSubmit = async () => {
    if (!hasChange) {
      toast.error("Select at least one field to update")
      return
    }
    setIsSubmitting(true)
    try {
      const data: Parameters<typeof bulkUpdateIssues>[1] = {}
      if (zone !== null) data.zone = zone || null
      if (status) data.status = status as "open" | "in_progress" | "resolved" | "closed"
      if (priority) data.priority = priority as "low" | "medium" | "high" | "critical"
      if (assigneeId !== null) {
        data.assigneeId = assigneeId || null
        const assignee = assignees.find((a) => a.id === assigneeId)
        data.assigneeName = assignee?.name ?? null
      }
      const { updated } = await bulkUpdateIssues(ids, data)
      toast.success(`Updated ${updated} issue${updated !== 1 ? "s" : ""}`)
      onSuccess()
      onClearSelection()
      onOpenChange(false)
      setZone(null)
      setStatus(null)
      setPriority(null)
      setAssigneeId(null)
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
            <Tag className="h-5 w-5" />
            Bulk edit issues
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Update fields for {ids.length} selected issue{ids.length !== 1 ? "s" : ""}.
          </p>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Zone
            </Label>
            <Select
              value={zone ?? "unchanged"}
              onValueChange={(v) => setZone(v === "unchanged" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged" className="text-muted-foreground">
                  No change
                </SelectItem>
                <SelectItem value="">Clear zone</SelectItem>
                {zoneOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status ?? "unchanged"}
              onValueChange={(v) => setStatus(v === "unchanged" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged" className="text-muted-foreground">
                  No change
                </SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={priority ?? "unchanged"}
              onValueChange={(v) => setPriority(v === "unchanged" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged" className="text-muted-foreground">
                  No change
                </SelectItem>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select
              value={assigneeId ?? "unchanged"}
              onValueChange={(v) => setAssigneeId(v === "unchanged" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No change" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged" className="text-muted-foreground">
                  No change
                </SelectItem>
                <SelectItem value="">Unassign</SelectItem>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !hasChange}
              className="flex-1"
            >
              {isSubmitting ? "Updating…" : `Apply to ${ids.length} issues`}
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
