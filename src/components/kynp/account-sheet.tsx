'use client'

import * as React from 'react'
import { useKynpStore, type ViewKey } from '@/store/kynp'
import { useSessionQuery, SignOutButton } from '@/components/kynp/auth-gate'
import Image from 'next/image'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  LayoutGrid,
  Megaphone,
  ListChecks,
  KeyRound,
  Mail,
  History,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV: { key: ViewKey; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'dashboard', label: 'Dashboard', hint: 'Status · Start / Stop', icon: LayoutGrid },
  { key: 'campaign', label: 'New Campaign', hint: 'Country · Brand · Service', icon: Megaphone },
  { key: 'leads', label: 'Leads & Messages', hint: 'Live queue', icon: ListChecks },
  { key: 'apikeys', label: 'API Keys', hint: 'Serper.dev', icon: KeyRound },
  { key: 'gmails', label: 'Gmail Accounts', hint: '5 slots · auto-rotate', icon: Mail },
  { key: 'history', label: 'Campaign History', hint: 'Past runs', icon: History },
]

export function AccountSheet() {
  const { sheetOpen, setSheetOpen, setView, view } = useKynpStore()
  const { data: session } = useSessionQuery()
  const user = session?.user

  const email = user?.email ?? ''
  const initials = email
    ? email.split('@')[0].split(/[^a-z0-9]/i).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'KP'
    : 'KP'
  const displayName = user?.name || email?.split('@')[0] || 'Operator'

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] p-0 bg-background border-l border-foreground/10"
      >
        {/* Header: brand identity */}
        <SheetHeader className="p-6 pb-4 border-b border-foreground/10 bg-gradient-to-b from-kynp-yellow/[0.06] to-transparent">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full overflow-hidden flex items-center justify-center">
              <Image src="/logo.png" alt="Kyn'P Leads logo" width={44} height={44} className="size-11 object-cover" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold tracking-tight">
                Kyn&rsquo;P Leads
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Find &middot; Compose &middot; Send &middot; Follow up
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Account chip */}
        <div className="px-6 py-4 border-b border-foreground/10 flex items-center gap-3">
          <div className="size-9 rounded-full bg-kynp-yellow text-kynp-black font-semibold text-sm flex items-center justify-center">
            👑
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">BOSS</p>
            <p className="text-xs text-muted-foreground truncate">{email || 'Not signed in'}</p>
          </div>
          <SignOutButton />
        </div>

        {/* Navigation */}
        <nav className="px-2 py-2 flex-1 overflow-y-auto kynp-scroll">
          <p className="kynp-eyebrow text-muted-foreground px-4 pt-2 pb-1">Workspace</p>
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon
              const active = view === item.key
              return (
                <li key={item.key}>
                  <button
                    onClick={() => setView(item.key)}
                    className={cn(
                      'w-full group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'bg-kynp-yellow/10 text-foreground'
                        : 'hover:bg-foreground/5 text-foreground/80',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', active ? 'text-kynp-yellow' : 'text-muted-foreground')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">{item.hint}</p>
                    </div>
                    {active && <span className="size-1.5 rounded-full bg-kynp-yellow" />}
                    <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-foreground/10 px-6 py-4">
          <p className="text-[11px] text-muted-foreground">
            Kyn&rsquo;P Leads v2.0 &middot; Multi-tenant. Your keys, Gmails &amp; leads stay in your workspace only.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
