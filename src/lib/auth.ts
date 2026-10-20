import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

/**
 * NextAuth configuration for Kyn'P Leads.
 *
 * - Credentials provider: email + password (hashed with bcrypt).
 * - JWT session strategy (no DB session table needed for SQLite).
 * - The user.id from the DB is exposed on the JWT and the session object so
 *   every API route can scope data to the authenticated user.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 10 * 365 * 24 * 60 * 60 }, // 10 years — permanent login
  pages: {
    // Not actually routed (we only have `/`) — kept for completeness.
    signIn: '/',
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Kyn\'P Account',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })
        if (!user) return null
        const ok = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!ok) return null
        return { id: user.id, email: user.email, name: user.name ?? undefined }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id
        token.email = user.email!
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.userId
        ;(session.user as any).email = token.email
      }
      return session
    },
  },
}

export type KynpSession = {
  user: { id: string; email: string; name?: string | null }
}
