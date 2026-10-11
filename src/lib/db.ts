import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __prismaUncaughtHandlerInstalled?: boolean
}

/**
 * PrismaClient is configured directly here. No driver adapter needed because:
 *
 * - In local dev, DATABASE_URL points to a local SQLite file (`file:...`)
 *   and Prisma uses its native SQLite driver.
 * - In production (Vercel), DATABASE_URL points to a Postgres connection
 *   string (`postgresql://...`) and Prisma uses its native Postgres driver.
 *
 * Both providers are supported natively by Prisma — no adapter required.
 *
 * Note: We tried Turso (libsql) but the @prisma/adapter-libsql package
 * crashes Node via "URL_INVALID" unhandled rejections in dev. Postgres
 * is the safer path.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['warn', 'error'] : ['error'],
  })
}

// In dev, Prisma's internal keep-alive / engine cleanup can emit async
// rejections that crash the Next.js dev server (Turbopack). Catch them so
// the server keeps running. These are usually benign — the actual query
// has already completed.
if (process.env.NODE_ENV !== 'production' && !globalForPrisma.__prismaUncaughtHandlerInstalled) {
  globalForPrisma.__prismaUncaughtHandlerInstalled = true
  process.on('unhandledRejection', (reason) => {
    const msg = (reason as any)?.message || String(reason)
    if (msg.includes('URL_INVALID') || msg.includes('LibsqlError') || msg.includes('Transaction already closed') || msg.includes('prepared statement')) {
      console.warn('[db] suppressed benign Prisma rejection:', msg.slice(0, 120))
      return
    }
    console.error('[db] unhandled rejection:', msg)
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
