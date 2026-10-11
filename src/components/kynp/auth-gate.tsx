'use client'

import * as React from 'react'
import { signIn, signOut } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  LogOut,
  AlertCircle,
  Check,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface SessionUser {
  id?: string
  email?: string
  name?: string | null
}
interface SessionResp {
  user: SessionUser | null
}

async function fetchSession(): Promise<SessionResp> {
  const res = await fetch('/api/auth/session', { cache: 'no-store' })
  if (!res.ok) return { user: null }
  const j = await res.json()
  return { user: j?.user ?? null }
}

// ---------- Validation ----------
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validateEmail(v: string): string | null {
  if (!v) return 'Email is required.'
  if (!emailRegex.test(v)) return 'Enter a valid email like you@company.com.'
  return null
}
function validatePassword(v: string): string | null {
  if (!v) return 'Password is required.'
  if (v.length < 8) return 'Password must be at least 8 characters.'
  if (v.length > 128) return 'Password is too long (max 128).'
  if (!/[a-zA-Z]/.test(v)) return 'Add at least one letter.'
  if (!/[0-9]/.test(v)) return 'Add at least one number.'
  return null
}
function validateName(v: string): string | null {
  if (!v) return 'Name is required.'
  if (v.trim().length < 1) return 'Name is required.'
  if (v.length > 80) return 'Name is too long (max 80).'
  return null
}

export function AuthGate({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
}) {
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [name, setName] = React.useState('')
  const [touched, setTouched] = React.useState<{ [k: string]: boolean }>({})
  const [busy, setBusy] = React.useState(false)

  const qc = useQueryClient()

  // Inline error computation (only shown after the field is touched or submit attempted)
  const emailErr = touched.email ? validateEmail(email) : null
  const pwErr = touched.password ? validatePassword(password) : null
  const nameErr = mode === 'signup' && touched.name ? validateName(name) : null

  // Block submit unless all fields are valid
  const formInvalid =
    !!validateEmail(email) ||
    !!validatePassword(password) ||
    (mode === 'signup' && !!validateName(name))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setTouched({ email: true, password: true, name: true })
    if (formInvalid) {
      toast.error('Please fix the highlighted fields before continuing.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: name || undefined }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Signup failed')
        toast.success('Account created. Signing you in…')
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        throw new Error(mode === 'signup' ? 'Auto sign-in failed — please sign in manually.' : 'Wrong email or password.')
      }
      toast.success(mode === 'signup' ? 'Welcome to Kyn\'P Leads.' : 'Signed in.')
      qc.invalidateQueries({ queryKey: ['session'] })
      setEmail(''); setPassword(''); setName('')
      setTouched({})
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Brand strip */}
        <div className="bg-kynp-yellow px-6 py-5 flex items-center gap-3">
          <div className="size-11 rounded-full overflow-hidden flex items-center justify-center">
            <img src="/logo.png" alt="Kyn'P Leads" className="size-11 object-cover" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-kynp-black">
              {mode === 'signup' ? 'Create your Kyn\'P account' : 'Sign in to Kyn\'P Leads'}
            </DialogTitle>
            <DialogDescription className="text-xs text-kynp-black/70">
              Multi-tenant outreach platform — your data stays yours.
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-4 space-y-4" noValidate>
          {mode === 'signup' && (
            <Field
              icon={<User className="size-4" />}
              label="Your name"
              type="text"
              value={name}
              onChange={(v) => { setName(v); setTouched((t) => ({ ...t, name: true })) }}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="Jane Doe"
              error={nameErr}
              required
            />
          )}
          <Field
            icon={<Mail className="size-4" />}
            label="Email"
            type="email"
            value={email}
            onChange={(v) => { setEmail(v); setTouched((t) => ({ ...t, email: true })) }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="you@company.com"
            error={emailErr}
            required
          />
          <Field
            icon={<Lock className="size-4" />}
            label="Password"
            type="password"
            value={password}
            onChange={(v) => { setPassword(v); setTouched((t) => ({ ...t, password: true })) }}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            placeholder={mode === 'signup' ? 'Min 8 chars, with a letter and a number' : 'Your password'}
            error={pwErr}
            required
          />

          {mode === 'signup' && (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <ShieldCheck className="size-3.5 text-kynp-yellow shrink-0 mt-0.5" />
              By signing up you confirm that you will use Kyn&apos;P Leads only for outreach to
              recipients you have a legitimate basis to contact, and you will comply with
              applicable anti-spam laws (CAN-SPAM, GDPR, etc.).
            </p>
          )}

          <button
            type="submit"
            disabled={busy || formInvalid}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
              busy || formInvalid
                ? 'bg-foreground/10 text-muted-foreground cursor-not-allowed'
                : 'bg-kynp-black text-kynp-yellow hover:bg-kynp-ink',
            )}
          >
            {busy ? (
              <><Loader2 className="size-4 animate-spin" /> Working…</>
            ) : (
              <>
                {mode === 'signup' ? 'Create account' : 'Sign in'}
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
              setTouched({})
            }}
            className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
          >
            {mode === 'signin' ? (
              <>New to Kyn&apos;P? <span className="text-kynp-yellow font-medium">Create an account</span></>
            ) : (
              <>Already have an account? <span className="text-kynp-yellow font-medium">Sign in</span></>
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  icon,
  label,
  type,
  value,
  onChange,
  onBlur,
  placeholder,
  required,
  error,
}: {
  icon: React.ReactNode
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  required?: boolean
  error?: string | null
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        {icon}{label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        className={cn(
          'w-full rounded-md bg-background border px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-shadow',
          error
            ? 'border-red-500/50 focus:ring-red-500/30'
            : 'border-foreground/15 focus:ring-kynp-yellow/40 focus:border-kynp-yellow/40',
        )}
      />
      {error && (
        <span className="text-[11px] text-red-500 inline-flex items-center gap-1">
          <AlertCircle className="size-3" /> {error}
        </span>
      )}
      {!error && value && type === 'password' && value.length >= 8 && (
        <span className="text-[11px] text-emerald-500 inline-flex items-center gap-1">
          <Check className="size-3" /> Looks good.
        </span>
      )}
    </label>
  )
}

export function useSessionQuery() {
  return useQuery<SessionResp>({
    queryKey: ['session'],
    queryFn: fetchSession,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function SignOutButton() {
  const qc = useQueryClient()
  return (
    <button
      onClick={async () => {
        await signOut({ redirect: false })
        qc.invalidateQueries({ queryKey: ['session'] })
        toast.success('Signed out.')
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-foreground/5 hover:bg-foreground/10 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <LogOut className="size-3" /> Sign out
    </button>
  )
}
