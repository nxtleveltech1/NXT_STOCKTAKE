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
  supplier: string | null
  supplierId: number | null
  listPrice: number | null
  costPrice: number | null
  /** True when search matched this item's barcode exactly (API response only) */
  exactBarcodeMatch?: boolean
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
  pausedAt: string | null
  totalPausedSeconds: number
  location: string
  totalItems: number
  countedItems: number
  varianceItems: number
  verifiedItems: number
  teamMembers: number
  /** True when no DB session exists (synthetic default); Pause/Resume disabled */
  isDefault?: boolean
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
  supplier?: string
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
  if (opts?.supplier) params.set('supplier', opts.supplier)
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

export async function fetchSuppliers(): Promise<string[]> {
  const res = await fetch('/api/stock/suppliers')
  if (!res.ok) throw new Error('Failed to fetch suppliers')
  return res.json() as Promise<string[]>
}

export async function fetchStockSession() {
  const res = await fetch('/api/stock/session')
  if (!res.ok) throw new Error('Failed to fetch session')
  return res.json() as Promise<StockSession>
}

export async function createStockSession(name?: string): Promise<StockSession> {
  const res = await fetch('/api/stock/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name ?? 'Q1 Full Stock Take' }),
  })
  if (!res.ok) throw new Error('Failed to create session')
  return res.json() as Promise<StockSession>
}

export async function patchStockSession(
  status: 'live' | 'paused' | 'completed'
): Promise<StockSession> {
  const res = await fetch('/api/stock/session', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('Failed to update session')
  return res.json() as Promise<StockSession>
}

export async function fetchExportCsv(): Promise<Blob> {
  const res = await fetch('/api/stock/export')
  if (!res.ok) throw new Error('Failed to export')
  return res.blob()
}

export async function patchZoneAssignments(
  assignments: Array<{ zoneCode: string; userId: string }>
): Promise<Array<{ zoneCode: string; userId: string }>> {
  const res = await fetch('/api/stock/zones/assign', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments }),
  })
  if (!res.ok) throw new Error('Failed to update zone assignments')
  return res.json() as Promise<Array<{ zoneCode: string; userId: string }>>
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

export type TeamStatsItem = {
  userId: string
  zoneCode: string | null
  itemsCounted: number
  lastActive: string
}

export async function fetchTeamStats(): Promise<TeamStatsItem[]> {
  const res = await fetch('/api/stock/team-stats')
  if (!res.ok) throw new Error('Failed to fetch team stats')
  return res.json()
}

export async function updateItemCount(
  id: string,
  countedQty: number,
  barcode?: string,
  location?: string
) {
  const body: { countedQty: number; barcode?: string; location?: string } = { countedQty }
  if (typeof barcode === 'string' && barcode.trim()) body.barcode = barcode.trim()
  if (typeof location === 'string' && location.trim() && location !== 'All Zones') body.location = location.trim()
  const res = await fetch(`/api/stock/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to update count')
  }
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
  supplier?: string | null
  countedQty?: number
  verified?: boolean
}

export async function verifyStockItem(id: string): Promise<StockItem> {
  const res = await fetch(`/api/stock/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified: true }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Failed to verify')
  }
  return res.json() as Promise<StockItem>
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
  if (data.supplier !== undefined) body.supplier = data.supplier
  if (typeof data.countedQty === 'number') body.countedQty = data.countedQty
  if (data.verified === true) body.verified = true

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

// Issue Log types and API
export type StockIssue = {
  id: string
  organizationId: string | null
  sessionId: string | null
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: string | null
  zone: string | null
  itemId: string | null
  reporterId: string
  reporterName: string
  assigneeId: string | null
  assigneeName: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  commentCount?: number
}

export type StockIssueComment = {
  id: string
  issueId: string
  userId: string
  userName: string
  body: string
  createdAt: string
}

export type StockIssuesResponse = {
  issues: StockIssue[]
  total: number
}

export type CreateIssueInput = {
  title: string
  description?: string | null
  priority?: 'low' | 'medium' | 'high' | 'critical'
  category?: string | null
  zone?: string | null
  itemId?: string | null
  sessionId?: string | null
}

export type UpdateIssueInput = {
  status?: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  assigneeId?: string | null
  assigneeName?: string | null
}

export async function fetchIssues(opts?: {
  sessionId?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<StockIssuesResponse> {
  const params = new URLSearchParams()
  if (opts?.sessionId) params.set('sessionId', opts.sessionId)
  if (opts?.status) params.set('status', opts.status)
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.offset) params.set('offset', String(opts.offset))
  const res = await fetch(`/api/stock/issues?${params}`)
  if (!res.ok) throw new Error('Failed to fetch issues')
  return res.json() as Promise<StockIssuesResponse>
}

export async function createIssue(data: CreateIssueInput): Promise<StockIssue> {
  const res = await fetch('/api/stock/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create issue')
  return res.json() as Promise<StockIssue>
}

export async function fetchIssue(id: string): Promise<StockIssue> {
  const res = await fetch(`/api/stock/issues/${id}`)
  if (!res.ok) throw new Error('Failed to fetch issue')
  return res.json() as Promise<StockIssue>
}

export async function updateIssue(id: string, data: UpdateIssueInput): Promise<StockIssue> {
  const res = await fetch(`/api/stock/issues/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update issue')
  return res.json() as Promise<StockIssue>
}

export async function fetchIssueComments(id: string): Promise<{ comments: StockIssueComment[] }> {
  const res = await fetch(`/api/stock/issues/${id}/comments`)
  if (!res.ok) throw new Error('Failed to fetch comments')
  return res.json() as Promise<{ comments: StockIssueComment[] }>
}

export async function addIssueComment(id: string, body: string): Promise<StockIssueComment> {
  const res = await fetch(`/api/stock/issues/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
  if (!res.ok) throw new Error('Failed to add comment')
  return res.json() as Promise<StockIssueComment>
}
