/**
 * One-time fix: correct product names corrupted by SheetJS raw:false S-dropping bug.
 * Fetches correct names from Odoo and updates DB. Run after XLSX raw:true fix is deployed.
 *
 * Usage: bun run scripts/fix-s-dropping.ts [--dry-run]
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { NXT_STOCK_ORG_ID } from '@/lib/org'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL required')
const adapter = new PrismaNeon({ connectionString })
const db = new PrismaClient({ adapter })

const ODOO_MCP_URL = 'https://nxtleveltech.odoo.com/mcp'
const ODOO_MCP_KEY = '5c264b5289bb0f86054313fde16b2fb9683baf4a'

let mcpSessionId: string | null = null
let mcpRequestId = 0

async function mcpCall(method: string, params: Record<string, unknown>): Promise<unknown> {
  mcpRequestId++
  const body = { jsonrpc: '2.0', method, params, id: mcpRequestId }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-MCP-KEY': ODOO_MCP_KEY,
  }
  if (mcpSessionId) headers['Mcp-Session-Id'] = mcpSessionId

  const res = await fetch(ODOO_MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) })
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
      } catch {
        /* skip */
      }
    }
    throw new Error(`MCP SSE: no valid JSON-RPC result`)
  }
  return res.json()
}

async function mcpInitialize(): Promise<void> {
  await mcpCall('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'fix-s-dropping', version: '1.0.0' },
  })
  await mcpCall('notifications/initialized', {})
}

async function mcpToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const raw = (await mcpCall('tools/call', { name: toolName, arguments: args })) as {
    result?: { content?: Array<{ type?: string; text?: string }>; isError?: boolean }
    error?: { code?: number; message?: string }
  }
  if (raw?.error) throw new Error(`MCP error [${raw.error.code}]: ${raw.error.message}`)
  if (raw?.result?.isError) {
    const errText = raw.result.content?.[0]?.text ?? JSON.stringify(raw.result)
    throw new Error(`MCP tool error (${toolName}): ${errText}`)
  }
  const content = raw?.result?.content
  if (Array.isArray(content) && content[0]?.text) return JSON.parse(content[0].text)
  return raw
}

type OdooProduct = { id: number; default_code: string | false; name: string }

async function fetchProductById(odooProductId: number): Promise<OdooProduct | null> {
  const batch = (await mcpToolCall('search_read', {
    model: 'product.product',
    domain: [['id', '=', odooProductId]],
    fields: ['id', 'default_code', 'name'],
    limit: 1,
  })) as OdooProduct[]
  return Array.isArray(batch) && batch.length > 0 ? batch[0] : null
}

async function fetchProductBySku(sku: string): Promise<OdooProduct | null> {
  const batch = (await mcpToolCall('search_read', {
    model: 'product.product',
    domain: [['default_code', '=', sku]],
    fields: ['id', 'default_code', 'name'],
    limit: 1,
  })) as OdooProduct[]
  return Array.isArray(batch) && batch.length > 0 ? batch[0] : null
}

function cleanOdooName(name: string): string {
  return name.replace(/^\[.*?\]\s*/, '').trim()
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log('=== Fix S-Dropping (One-time data correction) ===\n')
  if (dryRun) console.log('DRY RUN – no DB updates\n')

  // Find items where DB name likely differs from Odoo (has "tar" but not "star", or other s-dropping patterns)
  const suspected = await db.stockItem.findMany({
    where: {
      organizationId: NXT_STOCK_ORG_ID,
      OR: [
        { name: { contains: 'tar', mode: 'insensitive' }, NOT: { name: { contains: 'star', mode: 'insensitive' } } },
        { name: { contains: 'Ba ', mode: 'insensitive' } }, // "Bass" → "Ba "
        { name: { contains: 'Cla ic', mode: 'insensitive' } }, // "Classic" → "Cla ic"
        { name: { contains: 'Acou tic', mode: 'insensitive' } }, // "Acoustic" → "Acou tic"
        { name: { contains: ' erie ', mode: 'insensitive' } }, // "series" → " erie "
      ],
    },
    select: { id: true, sku: true, name: true, odooProductId: true },
  })

  console.log(`Suspected corrupted items: ${suspected.length}`)
  if (suspected.length === 0) {
    console.log('Nothing to fix.')
    process.exit(0)
  }

  console.log('Initializing Odoo MCP...')
  await mcpInitialize()

  let updated = 0
  let skipped = 0
  let notFound = 0

  for (const item of suspected) {
    let odooProduct: OdooProduct | null = null
    if (item.odooProductId) {
      odooProduct = await fetchProductById(item.odooProductId)
    }
    if (!odooProduct && item.sku) {
      odooProduct = await fetchProductBySku(item.sku)
    }

    if (!odooProduct) {
      notFound++
      continue
    }

    const correctName = cleanOdooName(odooProduct.name)
    if (correctName === item.name) {
      skipped++
      continue
    }

    console.log(`\n${item.sku}:`)
    console.log(`  DB:   "${item.name}"`)
    console.log(`  Fix:  "${correctName}"`)

    if (!dryRun) {
      await db.stockItem.update({
        where: { id: item.id },
        data: { name: correctName },
      })
      updated++
    } else {
      updated++
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Suspected: ${suspected.length}`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (already correct): ${skipped}`)
  console.log(`Not found in Odoo: ${notFound}`)

  if (dryRun && updated > 0) {
    console.log('\nRun without --dry-run to apply fixes.')
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
