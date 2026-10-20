'use client'

import * as React from 'react'
import { signIn, signOut } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Phone,
  ShieldCheck,
  ArrowRight,
  LogOut,
  Lock,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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

export function AuthGate({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
}) {
  const [step, setStep] = React.useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = React.useState('')
  const [code, setCode] = React.useState('')
  const [displayCode, setDisplayCode] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const qc = useQueryClient()

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (phone.trim().length < 7) {
      toast.error('Enter a valid phone number')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/phone-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send code')
      setDisplayCode(json.displayCode)

      // Auto-login for BOSS — skip manual code entry
      if (json.autoLogin) {
        // Auto-fill the code and submit
        setCode(json.displayCode)
        setStep('code')
        // Automatically submit after a brief delay
        setTimeout(() => {
          handleAutoVerify(json.displayCode)
        }, 500)
        return
      }

      setStep('code')
      toast.success('Code sent! Check below.')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (code.trim().length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setBusy(true)
    try {
      // Step 1: verify the phone code
      const verifyRes = await fetch('/api/auth/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const verifyJson = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyJson.error || 'Verification failed')

      // Step 2: sign in via NextAuth using the BOSS credentials
      const result = await signIn('credentials', {
        email: verifyJson.email,
        password: verifyJson.password,
        redirect: false,
      })
      if (result?.error) {
        throw new Error('Sign-in failed. Try again.')
      }
      toast.success('Welcome back, BOSS.')
      qc.invalidateQueries({ queryKey: ['session'] })
      setPhone(''); setCode(''); setDisplayCode(''); setStep('phone')
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Auto-verify for BOSS — no manual code entry needed
  const handleAutoVerify = async (code: string) => {
    setBusy(true)
    try {
      const verifyRes = await fetch('/api/auth/phone-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const verifyJson = await verifyRes.json()
      if (!verifyRes.ok) throw new Error(verifyJson.error || 'Verification failed')

      const result = await signIn('credentials', {
        email: verifyJson.email,
        password: verifyJson.password,
        redirect: false,
      })
      if (result?.error) throw new Error('Sign-in failed')

      toast.success('Welcome back, BOSS.')
      qc.invalidateQueries({ queryKey: ['session'] })
      setPhone(''); setCode(''); setDisplayCode(''); setStep('phone')
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
          <div className="size-11 rounded-full overflow-hidden flex items-center justify-center border border-kynp-black/20">
            <img src="/logo.png" alt="Kyn'P Leads" className="size-11 object-cover" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-kynp-black">
              Kyn&rsquo;P Leads
            </DialogTitle>
            <DialogDescription className="text-xs text-kynp-black/70">
              Sign in with your phone number
            </DialogDescription>
          </div>
        </div>

        {step === 'phone' ? (
          <form onSubmit={handleSendCode} className="px-6 pb-6 pt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <Phone className="size-4" /> Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                className="w-full rounded-md bg-background border border-foreground/15 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-kynp-yellow/40"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter your phone number to receive a verification code.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
                busy ? 'bg-foreground/10 text-muted-foreground' : 'bg-kynp-black text-kynp-yellow hover:bg-kynp-ink',
              )}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              {busy ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="px-6 pb-6 pt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4" /> Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full rounded-md bg-background border border-foreground/15 px-3 py-2.5 text-lg font-mono text-center tracking-widest placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-kynp-yellow/40"
              />
              {/* Free implementation: show the code on screen (no SMS cost) */}
              {displayCode && (
                <div className="rounded-md bg-kynp-yellow/10 border border-kynp-yellow/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Your code: </span>
                  <span className="font-mono font-bold text-kynp-yellow text-base tracking-widest">{displayCode}</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
                busy ? 'bg-foreground/10 text-muted-foreground' : 'bg-kynp-black text-kynp-yellow hover:bg-kynp-ink',
              )}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              {busy ? 'Verifying...' : 'Verify & Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setDisplayCode('') }}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              ← Use a different phone number
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
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
        toast.success('Signed out, BOSS.')
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-foreground/5 hover:bg-foreground/10 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <LogOut className="size-3" /> Sign out
    </button>
  )
}
