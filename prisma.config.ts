import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { defineConfig } from 'prisma/config'

// Placeholder only for prisma generate (no DB connection). Runtime uses real DATABASE_URL.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://localhost:5432/placeholder?schema=public'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseUrl },
})
