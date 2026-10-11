'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from '@/components/kynp/app-shell'

export default function Home() {
  const [qc] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 1500, refetchOnWindowFocus: true },
        },
      }),
  )

  return (
    <QueryClientProvider client={qc}>
      <AppShell />
    </QueryClientProvider>
  )
}
