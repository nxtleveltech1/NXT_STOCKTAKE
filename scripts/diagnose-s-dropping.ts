/**
 * Diagnose S-dropping bug: compare DB vs Odoo for suspected corruptions.
 * Finds items with "tar" (likely "star" or "series") and checks Odoo source.
 *
 * Usage: bun run scripts/diagnose-s-dropping.ts [--excel path-to-excel]
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local'), override: true })

import * as XLSX from 'xlsx'
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
    throw new Error(`MCP SSE: no valid JSON-RPC result in ${events.length} events`)
  }
  return res.json()
}

async function mcpInitialize(): Promise<void> {
  await mcpCall('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'diagnose-s-dropping', version: '1.0.0' },
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

type OdooProduct = {
  id: number
  default_code: string | false
  name: string
}

async function fetchProductFromOdoo(sku: string): Promise<OdooProduct | null> {
  const batch = (await mcpToolCall('search_read', {
    model: 'product.product',
    domain: [['default_code', '=', sku]],
    fields: ['id', 'default_code', 'name'],
    limit: 1,
  })) as OdooProduct[]
  if (Array.isArray(batch) && batch.length > 0) return batch[0]
  return null
}

async function fetchProductById(odooProductId: number): Promise<OdooProduct | null> {
  const batch = (await mcpToolCall('search_read', {
    model: 'product.product',
    domain: [['id', '=', odooProductId]],
    fields: ['id', 'default_code', 'name'],
    limit: 1,
  })) as OdooProduct[]
  if (Array.isArray(batch) && batch.length > 0) return batch[0]
  return null
}

async function main() {
  const excelPath = process.argv.find((a) => a.startsWith('--excel='))?.split('=')[1]
    ?? process.argv[2]

  console.log('=== S-Dropping Diagnostic ===\n')

  // 1. PostgreSQL encoding check
  const encResult = await db.$queryRaw<[{ client_encoding: string }]>`SHOW client_encoding`
  console.log('PostgreSQL client_encoding:', encResult[0]?.client_encoding ?? 'unknown')

  // 2. Find suspected corruptions in DB (name contains "tar" but not "star")
  const suspected = await db.stockItem.findMany({
    where: {
      organizationId: NXT_STOCK_ORG_ID,
      name: {
        contains: 'tar',
        mode: 'insensitive',
      },
      NOT: {
        name: { contains: 'star', mode: 'insensitive' },
      },
    },
    select: { id: true, sku: true, name: true, odooProductId: true },
    take: 50,
  })

  console.log('\nDB items with "tar" (excluding "star") - suspected corruptions:', suspected.length)
  if (suspected.length === 0) {
    console.log('  None found. Try querying for other patterns or check if data is already correct.')
  }

  // 3. Compare with Odoo for each suspected item
  console.log('\nInitializing Odoo MCP...')
  await mcpInitialize()

  const results: Array<{
    sku: string
    dbName: string
    odooName: string | null
    match: boolean
    source: 'odoo' | 'not_found'
  }> = []

  for (const item of suspected.slice(0, 20)) {
    let odooProduct: OdooProduct | null = null
    if (item.odooProductId) {
      odooProduct = await fetchProductById(item.odooProductId)
    }
    if (!odooProduct && item.sku) {
      odooProduct = await fetchProductFromOdoo(item.sku)
    }

    const odooName = odooProduct?.name ?? null
    const match = odooName !== null && odooName === item.name

    results.push({
      sku: item.sku,
      dbName: item.name,
      odooName,
      match,
      source: odooProduct ? 'odoo' : 'not_found',
    })
  }

  console.log('\n=== Comparison (DB vs Odoo) ===')
  for (const r of results) {
    const status = r.source === 'not_found' ? '❓ Odoo not found' : r.match ? '✓ Match' : '⚠ MISMATCH'
    console.log(`\n${r.sku}: ${status}`)
    console.log(`  DB:   "${r.dbName}"`)
    if (r.odooName !== null) console.log(`  Odoo: "${r.odooName}"`)
  }

  const mismatches = results.filter((r) => r.source === 'odoo' && !r.match)
  const notFound = results.filter((r) => r.source === 'not_found')

  console.log('\n=== Summary ===')
  console.log(`Suspected in DB: ${suspected.length}`)
  console.log(`Compared: ${results.length}`)
  console.log(`Mismatches (DB ≠ Odoo): ${mismatches.length}`)
  console.log(`Not found in Odoo: ${notFound.length}`)

  if (mismatches.length > 0) {
    console.log('\n⚠ Root cause: DB has different text than Odoo → bug is in ingest (seed/Excel/import)')
  } else if (suspected.length > 0 && notFound.length === results.length) {
    console.log('\n⚠ Could not fetch from Odoo for any item. Check MCP connection.')
  } else if (suspected.length > 0 && mismatches.length === 0) {
    console.log('\n✓ Odoo matches DB for compared items. Bug may be upstream (Odoo source wrong) or in Excel path.')
  }

  // 4. Check Excel if path provided
  if (excelPath) {
    console.log('\n=== Excel source check ===')
    try {
      const wb = XLSX.readFile(excelPath)
      const sheetName = wb.SheetNames.find((s) => s.includes('SOH') || s.includes('Full')) ?? wb.SheetNames[0]!
      const ws = wb.Sheets[sheetName]!
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: '',
        raw: true, // raw: false (SheetJS) drops letter "s" in formatted text - use raw values
      })

      const excelBySku = new Map<string, string>()
      for (const row of rows) {
        const sku = String(row['Internal Ref'] ?? row['ID'] ?? '').trim()
        const product = String(row['Product'] ?? '')
        if (sku) excelBySku.set(sku, product)
      }

      console.log(`Excel file: ${excelPath}`)
      console.log(`Rows: ${rows.length}`)

      for (const r of results.slice(0, 5)) {
        const excelName = excelBySku.get(r.sku) ?? null
        if (excelName !== null) {
          const excelMatch = excelName === r.dbName
          console.log(`\n${r.sku}:`)
          console.log(`  Excel: "${excelName}"`)
          console.log(`  DB:    "${r.dbName}"`)
          console.log(`  Excel=DB: ${excelMatch ? '✓' : '⚠'}`)
        }
      }
    } catch (e) {
      console.error('Failed to read Excel:', e)
    }
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
