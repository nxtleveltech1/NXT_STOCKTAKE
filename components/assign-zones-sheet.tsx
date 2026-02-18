"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { MapPin } from "lucide-react"

type Zone = {
  zoneCode: string
  name: string
  code: string
  assigneeId?: string | null
}

type TeamMember = { id: string; name: string }

export function AssignZonesSheet({
  open,
  onOpenChange,
  zones,
  teamMembers,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  zones: Zone[]
  teamMembers: TeamMember[]
  onSave: (assignments: Array<{ zoneCode: string; userId: string }>) => Promise<void>
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {}
      for (const z of zones) {
        if (z.assigneeId) initial[z.zoneCode] = z.assigneeId
      }
      setAssignments(initial)
    }
  }, [open, zones])

  const handleSave = async () => {
    setSaving(true)
    try {
      const list = Object.entries(assignments)
        .filter(([, userId]) => userId)
        .map(([zoneCode, userId]) => ({ zoneCode, userId }))
      await onSave(list)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Assign Zones
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-6">
          {zones.map((zone) => (
            <div key={zone.zoneCode} className="flex flex-col gap-2">
              <Label className="text-sm font-medium">{zone.name}</Label>
              <Select
                value={assignments[zone.zoneCode] ?? ""}
                onValueChange={(v) =>
                  setAssignments((prev) => ({
                    ...prev,
                    [zone.zoneCode]: v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
