export type StockItem = {
  id: string
  sku: string
  name: string
  category: string
  location: string
  expectedQty: number
  countedQty: number | null
  variance: number | null
  status: "pending" | "counted" | "variance" | "verified"
  lastCountedBy: string | null
  lastCountedAt: string | null
  barcode: string | null
  uom: string | null
}

export type TeamMember = {
  id: string
  name: string
  avatar: string
  role: string
  zone: string
  itemsCounted: number
  status: "active" | "idle" | "offline"
  lastActive: string
}

export type StockSession = {
  id: string
  name: string
  status: "live" | "paused" | "completed"
  startedAt: string
  location: string
  totalItems: number
  countedItems: number
  varianceItems: number
  verifiedItems: number
  teamMembers: number
}

export type ActivityEvent = {
  id: string
  type: "count" | "variance" | "verify" | "join" | "zone_complete"
  message: string
  user: string
  timestamp: string
  zone?: string
}

export const ZONES = [
  "All Zones",
  "Zone A - TV & Display",
  "Zone B - Hi-Fi & Audio",
  "Zone C - Headphones & Portable",
  "Zone D - Home Cinema",
  "Zone E - Cables & Accessories",
  "Zone F - Pro AV & Install",
]

export const CATEGORIES = [
  "All Categories",
  "Televisions",
  "Speakers",
  "Headphones",
  "Soundbars",
  "Turntables & Vinyl",
  "Projectors",
  "AV Receivers",
  "Cables & Interconnects",
  "Streaming Devices",
  "Subwoofers",
  "Mounts & Stands",
]

