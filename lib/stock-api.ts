export type StockItem = {
  id: string
  odooId: number
  sku: string
  name: string
  category: string
  location: string
  warehouse: string
  expectedQty: number
  reservedQty: number
  availableQty: number
  countedQty: number | null
  variance: number | null
  status: 'pending' | 'counted' | 'variance' | 'verified'
  lastCountedBy: string | null
  lastCountedAt: string | null
  barcode: string | null
  uom: string | null
  serialNumber: string | null
  owner: string | null
}

export type StockSummary = {
  total: number
  pending: number
  counted: number
  variance: number
  verified: number
}

export type StockSession = {
  id: string
  name: string
  status: 'live' | 'paused' | 'completed'
  startedAt: string
  location: string
  totalItems: number
  countedItems: number
  varianceItems: number
  verifiedItems: number
  teamMembers: number
}

export type StockItemsResponse = {
  items: StockItem[]
  total: number
  filteredTotal: number
  summary: StockSummary
}

export async function fetchStockItems(opts?: {
  location?: string
  status?: string
  search?: string
  category?: string
  uom?: string
  warehouse?: string
  page?: number
  limit?: number
}): Promise<StockItemsResponse> {
  const params = new URLSearchParams()
  if (opts?.location) params.set('location', opts.location)
  if (opts?.status) params.set('status', opts.status)
  if (opts?.search) params.set('search', opts.search)
  if (opts?.category) params.set('category', opts.category)
  if (opts?.uom) params.set('uom', opts.uom)
  if (opts?.warehouse) params.set('warehouse', opts.warehouse)
  if (opts?.page) params.set('page', String(opts.page))
  if (opts?.limit) params.set('limit', String(opts.limit ?? 100))
  const res = await fetch(`/api/stock/items?${params}`)
  if (!res.ok) throw new Error('Failed to fetch items')
  return res.json() as Promise<StockItemsResponse>
}

export async function fetchCategories(): Promise<string[]> {
  const res = await fetch('/api/stock/categories')
  if (!res.ok) throw new Error('Failed to fetch categories')
  return res.json() as Promise<string[]>
}

export async function fetchWarehouses(): Promise<string[]> {
  const res = await fetch('/api/stock/warehouses')
  if (!res.ok) throw new Error('Failed to fetch warehouses')
  return res.json() as Promise<string[]>
}

export async function fetchStockSession() {
  const res = await fetch('/api/stock/session')
  if (!res.ok) throw new Error('Failed to fetch session')
  return res.json() as Promise<StockSession>
}

export async function fetchLocations() {
  const res = await fetch('/api/stock/locations')
  if (!res.ok) throw new Error('Failed to fetch locations')
  return res.json() as Promise<string[]>
}

export async function fetchZones() {
  const res = await fetch('/api/stock/zones')
  if (!res.ok) throw new Error('Failed to fetch zones')
  return res.json()
}

export async function updateItemCount(
  id: string,
  countedQty: number,
  barcode?: string
) {
  const body: { countedQty: number; barcode?: string } = { countedQty }
  if (typeof barcode === 'string' && barcode.trim()) body.barcode = barcode.trim()
  const res = await fetch(`/api/stock/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to update count')
  return res.json() as Promise<StockItem>
}

export type UpdateStockItemInput = {
  sku?: string
  name?: string
  barcode?: string | null
  uom?: string | null
  location?: string
  category?: string | null
  warehouse?: string | null
  serialNumber?: string | null
  owner?: string | null
  countedQty?: number
}

export async function updateStockItem(
  id: string,
  data: UpdateStockItemInput
): Promise<StockItem> {
  const body: Record<string, unknown> = {}
  if (data.sku != null) body.sku = data.sku
  if (data.name != null) body.name = data.name
  if (data.barcode !== undefined) body.barcode = data.barcode
  if (data.uom !== undefined) body.uom = data.uom
  if (data.location != null) body.location = data.location
  if (data.category !== undefined) body.category = data.category
  if (data.warehouse !== undefined) body.warehouse = data.warehouse
  if (data.serialNumber !== undefined) body.serialNumber = data.serialNumber
  if (data.owner !== undefined) body.owner = data.owner
  if (typeof data.countedQty === 'number') body.countedQty = data.countedQty

  const res = await fetch(`/api/stock/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to update item')
  return res.json() as Promise<StockItem>
}

export async function fetchUoms(): Promise<string[]> {
  const res = await fetch('/api/stock/uoms')
  if (!res.ok) throw new Error('Failed to fetch UOMs')
  return res.json() as Promise<string[]>
}

export type ActivityEvent = {
  id: string
  type: 'count' | 'variance' | 'verify' | 'join' | 'zone_complete'
  message: string
  user: string
  timestamp: string
  zone?: string
}

export async function fetchActivity(limit = 50): Promise<ActivityEvent[]> {
  const res = await fetch(`/api/stock/activity?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch activity')
  return res.json() as Promise<ActivityEvent[]>
}
