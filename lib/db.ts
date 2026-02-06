import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')
  const adapter = new PrismaNeon({ connectionString })
  const client = new PrismaClient({ adapter })
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
  return client
}

export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return (getPrisma() as Record<string, unknown>)[prop as string]
  },
})
