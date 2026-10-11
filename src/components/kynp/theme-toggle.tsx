'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const isDark = mounted ? (resolvedTheme === 'dark' || theme === 'dark') : false

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex items-center justify-center size-9 rounded-lg border border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors"
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4 text-kynp-yellow" />
        ) : (
          <Moon className="size-4" />
        )
      ) : (
        <div className="size-4" />
      )}
    </button>
  )
}
