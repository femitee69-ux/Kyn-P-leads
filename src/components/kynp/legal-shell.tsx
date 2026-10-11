import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'

export function LegalShell({
  title,
  eyebrow,
  effectiveDate,
  children,
}: {
  title: string
  eyebrow: string
  effectiveDate: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-foreground/10 bg-background/85 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-9 rounded-full overflow-hidden flex items-center justify-center">
              <Image src="/logo.png" alt="Kyn'P Leads" width={36} height={36} className="size-9 object-cover" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold tracking-tight leading-none">
                Kyn&rsquo;P <span className="text-kynp-yellow">Leads</span>
              </p>
              <p className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">
                Find &middot; Compose &middot; Send &middot; Follow up
              </p>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to app
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <p className="kynp-eyebrow text-kynp-yellow">{eyebrow}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
          {title}
        </h1>
        <p className="mt-3 text-xs text-muted-foreground">
          Last updated: {effectiveDate}
        </p>
        <div className="mt-10 sm:mt-12 space-y-8 leading-relaxed text-sm sm:text-base text-foreground/90">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-foreground/10 bg-background/85 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Kyn&rsquo;P Leads. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/" className="hover:text-foreground">App</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="space-y-3 text-sm sm:text-base text-foreground/85 leading-relaxed">{children}</div>
    </section>
  )
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-foreground/85">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
