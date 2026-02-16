/**
 * backfill-suppliers.ts
 * Populates the supplier + supplierId columns on StockItem records
 * by fetching supplier info from Odoo MCP.
 *
 * This does NOT delete/recreate data — it only UPDATEs existing rows.
 *
 * Usage: bun run scripts/backfill-suppliers.ts
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

  const sid = res.headers.get('Mcp-Session-Id')
  if (sid) mcpSessionId = sid

  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('text/event-stream')) {
    const text = await res.text()
    const events: string[] = []
    let currentData = ''
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        currentData += (currentData ? '\n' : '') + line.slice(6)
      } else if (line.trim() === '' && currentData) {
        events.push(currentData)
        currentData = ''
      }
    }
    if (currentData) events.push(currentData)

    for (let i = events.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(events[i])
        if (parsed?.result || parsed?.error) return parsed
      } catch { /* skip non-JSON events */ }
    }

    throw new Error(`MCP SSE: no valid JSON-RPC result in ${events.length} events`)
  }

  return res.json()
}

async function mcpInitialize(): Promise<void> {
  const result = await mcpCall('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'backfill-suppliers', version: '1.0.0' },
  })
  console.log('MCP initialized:', JSON.stringify(result).slice(0, 200))
  await mcpCall('notifications/initialized', {})
}

async function mcpToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const raw = (await mcpCall('tools/call', { name: toolName, arguments: args })) as {
    result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
    error?: { code?: number; message?: string }
  }

  if (raw?.error) {
    throw new Error(`MCP error [${raw.error.code}]: ${raw.error.message}`)
  }
  if (raw?.result?.isError) {
    const errText = raw.result.content?.[0]?.text ?? JSON.stringify(raw.result)
    throw new Error(`MCP tool error (${toolName}): ${errText}`)
  }

  const content = raw?.result?.content
  if (Array.isArray(content) && content[0]?.text) {
    return JSON.parse(content[0].text)
  }

  console.warn(`  ⚠ Unexpected MCP response for ${toolName}:`, JSON.stringify(raw).slice(0, 300))
  return raw
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OdooProduct = {
  id: number
  product_tmpl_id: [number, string] | false
}

type OdooSupplierInfo = {
  id: number
  partner_id: [number, string]
  product_tmpl_id: [number, string] | false
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function backfill() {
  console.log('=== Backfill Suppliers ===\n')

  // 1. Get unique product IDs from DB
  console.log('1. Fetching stock items from database...')
  const items = await db.stockItem.findMany({
    where: { supplier: null, odooProductId: { not: null } },
    select: { id: true, odooProductId: true },
  })
  const productIds = [...new Set(items.map((i) => i.odooProductId).filter((id): id is number => id !== null))]
  console.log(`   Items missing supplier: ${items.length}`)
  console.log(`   Unique product IDs: ${productIds.length}`)

  if (productIds.length === 0) {
    console.log('   Nothing to backfill!')
    process.exit(0)
  }

  // 2. Initialize MCP
  console.log('\n2. Initializing MCP connection...')
  await mcpInitialize()

  // 3. Fetch products to get template IDs
  console.log('\n3. Fetching product template IDs from Odoo...')
  const productToTemplate = new Map<number, number>()
  const batchSize = 200

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batchIds = productIds.slice(i, i + batchSize)
    process.stdout.write(`\r   Products ${i + 1}-${i + batchIds.length} of ${productIds.length}...`)

    try {
      const batch = (await mcpToolCall('search_read', {
        model: 'product.product',
        domain: [['id', 'in', batchIds]],
        fields: ['id', 'product_tmpl_id'],
        limit: batchSize,
      })) as OdooProduct[]

      if (Array.isArray(batch)) {
        for (const p of batch) {
          const tmplId = Array.isArray(p.product_tmpl_id) ? p.product_tmpl_id[0] : null
          if (tmplId) productToTemplate.set(p.id, tmplId)
        }
      }
    } catch (err) {
      console.error(`\n   ✗ Failed batch at offset ${i}:`, err)
    }
  }
  console.log(`\n   Mapped ${productToTemplate.size} products to templates`)

  // 4. Fetch supplier info for those templates
  console.log('\n4. Fetching supplier info from Odoo...')
  const templateIds = [...new Set(productToTemplate.values())]
  const suppliersByTmpl = new Map<number, { name: string; id: number }>()

  for (let i = 0; i < templateIds.length; i += batchSize) {
    const batchIds = templateIds.slice(i, i + batchSize)
    process.stdout.write(`\r   Templates ${i + 1}-${i + batchIds.length} of ${templateIds.length}...`)

    try {
      const batch = (await mcpToolCall('search_read', {
        model: 'product.supplierinfo',
        domain: [['product_tmpl_id', 'in', batchIds]],
        fields: ['partner_id', 'product_tmpl_id'],
        limit: 2000,
      })) as OdooSupplierInfo[]

      if (Array.isArray(batch)) {
        for (const si of batch) {
          const tmplId = Array.isArray(si.product_tmpl_id) ? si.product_tmpl_id[0] : null
          if (tmplId && !suppliersByTmpl.has(tmplId) && Array.isArray(si.partner_id)) {
            suppliersByTmpl.set(tmplId, {
              name: si.partner_id[1],
              id: si.partner_id[0],
            })
          }
        }
      }
    } catch (err) {
      console.error(`\n   ✗ Failed supplier batch at offset ${i}:`, err)
    }
  }
  console.log(`\n   Found suppliers for ${suppliersByTmpl.size} templates`)

  // 5. Build product → supplier mapping
  const productToSupplier = new Map<number, { name: string; id: number }>()
  for (const [productId, tmplId] of productToTemplate) {
    const supplier = suppliersByTmpl.get(tmplId)
    if (supplier) productToSupplier.set(productId, supplier)
  }
  console.log(`\n5. Products with suppliers: ${productToSupplier.size} / ${productIds.length}`)

  // 6. Update database
  console.log('\n6. Updating database...')
  let updated = 0
  let skipped = 0

  for (const item of items) {
    const supplier = item.odooProductId ? productToSupplier.get(item.odooProductId) : null
    if (!supplier) {
      skipped++
      continue
    }

    await db.stockItem.update({
      where: { id: item.id },
      data: { supplier: supplier.name, supplierId: supplier.id },
    })
    updated++
    if (updated % 100 === 0) {
      process.stdout.write(`\r   Updated ${updated} items...`)
    }
  }

  console.log(`\n\n=== Backfill Complete ===`)
  console.log(`Updated:  ${updated}`)
  console.log(`Skipped:  ${skipped} (no supplier found in Odoo)`)
  console.log(`Unique suppliers: ${new Set([...productToSupplier.values()].map((s) => s.name)).size}`)

  process.exit(0)
}

backfill().catch((e) => {
  console.error('Backfill failed:', e)
  process.exit(1)
})
