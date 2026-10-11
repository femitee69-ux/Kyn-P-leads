import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Returns the authenticated user id or null.
 * Use `requireUserId` for endpoints that must be authenticated.
 */
export async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const id = (session?.user as any)?.id
  return id ? String(id) : null
}

export class UnauthorizedError extends Error {
  status = 401
  constructor() { super('Unauthorized — sign in to continue') }
}

export async function requireUserId(): Promise<string> {
  const id = await getUserId()
  if (!id) throw new UnauthorizedError()
  return id
}
