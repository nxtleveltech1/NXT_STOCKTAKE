/**
 * seed-from-odoo.ts
 * Pulls stock quants, product details, and supplier info from Odoo MCP
 * and writes them to the Neon database.
 *
 * Usage: bun run scripts/seed-from-odoo.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL required')
const adapter = new PrismaNeon({ connectionString })
const db = new PrismaClient({ adapter })

// ---------------------------------------------------------------------------
// Odoo MCP config
// ---------------------------------------------------------------------------
const ODOO_MCP_URL = 'https://nxtleveltech.odoo.com/mcp'
const ODOO_MCP_KEY = '5c264b5289bb0f86054313fde16b2fb9683baf4a'

let mcpSessionId: string | null = null
let mcpRequestId = 0

async function mcpCall(method: string, params: Record<string, unknown>): Promise<unknown> {
  mcpRequestId++
  const body = {
    jsonrpc: '2.0',
    method,
    params,
    id: mcpRequestId,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-MCP-KEY': ODOO_MCP_KEY,
  }
  if (mcpSessionId) {
    headers['Mcp-Session-Id'] = mcpSessionId
  }

  const res = await fetch(ODOO_MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  // Capture session ID from response headers
  const sid = res.headers.get('Mcp-Session-Id')
  if (sid) mcpSessionId = sid

  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('text/event-stream')) {
    // SSE response — parse the data events
    const text = await res.text()
    const lines = text.split('\n')
    let lastData = ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        lastData = line.slice(6)
      }
    }
    if (lastData) {
      return JSON.parse(lastData)
    }
    throw new Error(`MCP SSE response had no data events: ${text.slice(0, 500)}`)
  }

  return res.json()
}

async function mcpInitialize(): Promise<void> {
  const result = await mcpCall('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'seed-from-odoo', version: '1.0.0' },
  })
  console.log('MCP initialized:', JSON.stringify(result).slice(0, 200))
  // Send initialized notification
  await mcpCall('notifications/initialized', {})
}

async function mcpToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const result = (await mcpCall('tools/call', { name: toolName, arguments: args })) as {
    result?: { content?: Array<{ text?: string }> }
  }
  // Extract the text content from the MCP response
  const content = result?.result?.content
  if (Array.isArray(content) && content[0]?.text) {
    return JSON.parse(content[0].text)
  }
  return result
}

// ---------------------------------------------------------------------------
// Odoo data fetch helpers
// ---------------------------------------------------------------------------

type OdooQuant = {
  id: number
  product_id: [number, string] | false
  location_id: [number, string] | false
  warehouse_id: [number, string] | false
  quantity: number
  reserved_quantity: number
  available_quantity: number
  product_uom_id: [number, string] | false
  lot_id: [number, string] | false
  owner_id: [number, string] | false
}

type OdooProduct = {
  id: number
  default_code: string | false
  name: string
  categ_id: [number, string] | false
  barcode: string | false
  uom_id: [number, string] | false
  list_price: number
  standard_price: number
  seller_ids: number[]
  product_tmpl_id: [number, string] | false
}

type OdooSupplierInfo = {
  id: number
  partner_id: [number, string]
  product_tmpl_id: [number, string] | false
  product_id: [number, string] | false
  price: number
  discount: number
}

async function fetchAllQuants(): Promise<OdooQuant[]> {
  const allQuants: OdooQuant[] = []
  let offset = 0
  const limit = 2000

  while (true) {
    console.log(`  Fetching quants offset=${offset}...`)
    const batch = (await mcpToolCall('search_read', {
      model: 'stock.quant',
      domain: [['location_id.usage', '=', 'internal']],
      fields: [
        'product_id', 'location_id', 'warehouse_id', 'quantity',
        'reserved_quantity', 'available_quantity', 'product_uom_id',
        'lot_id', 'owner_id',
      ],
      limit,
      offset,
    })) as OdooQuant[]

    if (!Array.isArray(batch) || batch.length === 0) break
    allQuants.push(...batch)
    console.log(`  Got ${batch.length} quants (total: ${allQuants.length})`)
    if (batch.length < limit) break
    offset += limit
  }

  return allQuants
}

async function fetchProducts(productIds: number[]): Promise<Map<number, OdooProduct>> {
  const products = new Map<number, OdooProduct>()
  const batchSize = 200

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batchIds = productIds.slice(i, i + batchSize)
    console.log(`  Fetching products ${i + 1}-${i + batchIds.length} of ${productIds.length}...`)

    const batch = (await mcpToolCall('search_read', {
      model: 'product.product',
      domain: [['id', 'in', batchIds]],
      fields: [
        'id', 'default_code', 'name', 'categ_id', 'barcode',
        'uom_id', 'list_price', 'standard_price', 'seller_ids',
        'product_tmpl_id',
      ],
      limit: batchSize,
    })) as OdooProduct[]

    if (Array.isArray(batch)) {
      for (const p of batch) {
        products.set(p.id, p)
      }
    }
  }

  return products
}

async function fetchSupplierInfo(): Promise<Map<number, OdooSupplierInfo[]>> {
  // Fetch ALL supplier info and build a map by product_tmpl_id
  const suppliersByTmpl = new Map<number, OdooSupplierInfo[]>()
  let offset = 0
  const limit = 2000

  while (true) {
    console.log(`  Fetching supplier info offset=${offset}...`)
    const batch = (await mcpToolCall('search_read', {
      model: 'product.supplierinfo',
      domain: [],
      fields: ['partner_id', 'product_tmpl_id', 'product_id', 'price', 'discount'],
      limit,
      offset,
    })) as OdooSupplierInfo[]

    if (!Array.isArray(batch) || batch.length === 0) break

    for (const si of batch) {
      const tmplId = Array.isArray(si.product_tmpl_id) ? si.product_tmpl_id[0] : null
      if (tmplId) {
        const existing = suppliersByTmpl.get(tmplId) ?? []
        existing.push(si)
        suppliersByTmpl.set(tmplId, existing)
      }
    }

    console.log(`  Got ${batch.length} supplier records (total unique templates: ${suppliersByTmpl.size})`)
    if (batch.length < limit) break
    offset += limit
  }

  return suppliersByTmpl
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed() {
  console.log('=== Seed from Odoo MCP ===\n')

  // Step 1: Initialize MCP
  console.log('1. Initializing MCP connection...')
  await mcpInitialize()

  // Step 2: Fetch all stock quants
  console.log('\n2. Fetching stock quants from Odoo...')
  const quants = await fetchAllQuants()
  console.log(`   Total quants: ${quants.length}`)

  // Step 3: Get unique product IDs
  const productIds = [...new Set(
    quants
      .map((q) => (Array.isArray(q.product_id) ? q.product_id[0] : null))
      .filter((id): id is number => id !== null)
  )]
  console.log(`   Unique products in stock: ${productIds.length}`)

  // Step 4: Fetch product details
  console.log('\n3. Fetching product details...')
  const products = await fetchProducts(productIds)
  console.log(`   Products fetched: ${products.size}`)

  // Step 5: Fetch supplier info
  console.log('\n4. Fetching supplier info...')
  const suppliersByTmpl = await fetchSupplierInfo()
  console.log(`   Supplier mappings: ${suppliersByTmpl.size} templates`)

  // Step 6: Build stock items
  console.log('\n5. Building stock items...')
  const stockItems = quants.map((q) => {
    const productId = Array.isArray(q.product_id) ? q.product_id[0] : 0
    const productName = Array.isArray(q.product_id) ? q.product_id[1] : 'Unknown'
    const product = products.get(productId)

    // Get primary supplier
    const tmplId = product && Array.isArray(product.product_tmpl_id)
      ? product.product_tmpl_id[0]
      : null
    const suppliers = tmplId ? suppliersByTmpl.get(tmplId) ?? [] : []
    const primarySupplier = suppliers.length > 0 ? suppliers[0] : null

    const locationName = Array.isArray(q.location_id) ? q.location_id[1] : ''
    const warehouseName = Array.isArray(q.warehouse_id) ? q.warehouse_id[1] : null
    const uomName = Array.isArray(q.product_uom_id) ? q.product_uom_id[1] : null
    const lotName = Array.isArray(q.lot_id) ? q.lot_id[1] : null
    const ownerName = Array.isArray(q.owner_id) ? q.owner_id[1] : null

    // Clean SKU — strip the brackets and leading spaces from display name
    let sku = product?.default_code || ''
    if (typeof sku === 'string') {
      sku = sku.trim()
    }
    if (!sku || sku === 'false') {
      sku = String(productId)
    }

    // Clean product name — remove SKU prefix like "[SKU] "
    let name = product?.name ?? productName
    name = name.replace(/^\[.*?\]\s*/, '').trim()
    if (!name) name = productName

    return {
      odooId: q.id,
      odooProductId: productId,
      sku,
      name,
      category: product && Array.isArray(product.categ_id) ? product.categ_id[1] : null,
      location: locationName,
      warehouse: warehouseName,
      expectedQty: Math.round(q.quantity),
      reservedQty: Math.round(q.reserved_quantity),
      availableQty: Math.round(q.available_quantity),
      countedQty: null as number | null,
      variance: null as number | null,
      status: 'pending' as const,
      barcode: product?.barcode && product.barcode !== false ? String(product.barcode) : null,
      uom: uomName,
      serialNumber: lotName,
      owner: ownerName,
      supplier: primarySupplier ? primarySupplier.partner_id[1] : null,
      supplierId: primarySupplier ? primarySupplier.partner_id[0] : null,
      listPrice: product?.list_price ?? null,
      costPrice: product?.standard_price ?? null,
    }
  })

  console.log(`   Stock items built: ${stockItems.length}`)

  // Step 7: Write to database
  console.log('\n6. Writing to Neon database...')

  const existing = await db.stockItem.count()
  if (existing > 0) {
    console.log(`   Clearing ${existing} existing stock items...`)
    await db.stockItem.deleteMany({})
  }

  const BATCH_SIZE = 500
  let inserted = 0

  for (let i = 0; i < stockItems.length; i += BATCH_SIZE) {
    const batch = stockItems.slice(i, i + BATCH_SIZE)
    await db.stockItem.createMany({ data: batch })
    inserted += batch.length
    process.stdout.write(`\r   Inserted ${inserted}/${stockItems.length}`)
  }

  const total = await db.stockItem.count()

  // Update or create session
  const sessions = await db.stockSession.findMany()
  if (sessions.length === 0) {
    await db.stockSession.create({
      data: {
        name: 'Q1 Full Stock Take',
        status: 'live',
        location: 'NXT Stock',
        totalItems: total,
        countedItems: 0,
        varianceItems: 0,
        verifiedItems: 0,
        teamMembers: 0,
      },
    })
  } else {
    await db.stockSession.updateMany({ where: {}, data: { totalItems: total } })
  }

  // Print summary
  const supplierCount = new Set(stockItems.map((i) => i.supplier).filter(Boolean)).size
  const categoryCount = new Set(stockItems.map((i) => i.category).filter(Boolean)).size
  const locationCount = new Set(stockItems.map((i) => i.location).filter(Boolean)).size

  console.log(`\n\n=== Sync Complete ===`)
  console.log(`Total items:  ${total}`)
  console.log(`Suppliers:    ${supplierCount}`)
  console.log(`Categories:   ${categoryCount}`)
  console.log(`Locations:    ${locationCount}`)
  console.log(`With barcode: ${stockItems.filter((i) => i.barcode).length}`)
  console.log(`With SKU:     ${stockItems.filter((i) => i.sku && i.sku !== String(i.odooProductId)).length}`)

  process.exit(0)
}

seed().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
