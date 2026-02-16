import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

// Read DATABASE_URL from .env.local
const envContent = readFileSync('.env.local', 'utf8')
const dbUrl = envContent.match(/DATABASE_URL=["']?([^\s"']+)/)?.[1]
if (!dbUrl) throw new Error('DATABASE_URL not found')
const sql = neon(dbUrl)
const batches = JSON.parse(readFileSync('e:/00Project/ODOO-ADMIN/seed-sql-batches.json', 'utf8'))

console.log(`Executing ${batches.length} batches...`)

let inserted = 0
for (let i = 0; i < batches.length; i++) {
  try {
    await sql.query(batches[i])
    inserted += 50
    process.stdout.write(`\rBatch ${i + 1}/${batches.length} done (${Math.min(inserted, 2507)}/2507)`)
  } catch (err) {
    console.error(`\nBatch ${i} failed:`, err.message)
    console.error('SQL preview:', batches[i].substring(0, 200))
    process.exit(1)
  }
}

const [count] = await sql`SELECT COUNT(*) as total, SUM("expectedQty") as total_qty FROM "StockItem"`
console.log(`\nDone. ${count.total} items, total qty: ${count.total_qty}`)

const [byLoc] = await sql`SELECT location, COUNT(*) as cnt, SUM("expectedQty") as qty FROM "StockItem" GROUP BY location`
console.log('Verification by location pending...')

const locRows = await sql`SELECT location, COUNT(*) as cnt, SUM("expectedQty") as qty FROM "StockItem" GROUP BY location`
for (const r of locRows) {
  console.log(`  ${r.location}: ${r.cnt} items, qty=${r.qty}`)
}
