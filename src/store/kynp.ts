'use client'

import { create } from 'zustand'

export type ViewKey = 'dashboard' | 'campaign' | 'leads' | 'apikeys' | 'gmails' | 'history'

interface CampaignLiveStats {
  total: number
  sent: number
  followedUp: number
  pending: number
  failed: number
}

interface RecentDispatch {
  id: string
  name: string
  email: string
  company: string
  position: string | null
  status: string
  kind: 'initial' | 'follow_up' | null
  gmailSlot: number | null
  message: string
  sentAt: string | null
}

interface KynpState {
  // navigation
  view: ViewKey
  sheetOpen: boolean
  setView: (v: ViewKey) => void
  setSheetOpen: (b: boolean) => void

  // campaign
  campaignId: string | null
  campaignStatus: 'idle' | 'running' | 'paused' | 'completed' | 'unknown'
  isStarting: boolean
  isDispatching: boolean
  stats: CampaignLiveStats | null
  recent: RecentDispatch | null
  setCampaign: (id: string | null, status?: KynpState['campaignStatus']) => void
  setStarting: (b: boolean) => void
  setDispatching: (b: boolean) => void
  setStats: (s: CampaignLiveStats | null) => void
  setRecent: (r: RecentDispatch | null) => void

  // form
  country: string
  brand: string
  service: string
  followUp: boolean
  setForm: (patch: Partial<Pick<KynpState, 'country' | 'brand' | 'service' | 'followUp'>>) => void

  // last activity log
  log: string[]
  pushLog: (line: string) => void
  clearLog: () => void
}

export const useKynpStore = create<KynpState>((set) => ({
  view: 'dashboard',
  sheetOpen: false,
  setView: (v) => set({ view: v, sheetOpen: false }),
  setSheetOpen: (b) => set({ sheetOpen: b }),

  campaignId: null,
  campaignStatus: 'idle',
  isStarting: false,
  isDispatching: false,
  stats: null,
  recent: null,
  setCampaign: (id, status) =>
    set({ campaignId: id, campaignStatus: status ?? 'unknown' }),
  setStarting: (b) => set({ isStarting: b }),
  setDispatching: (b) => set({ isDispatching: b }),
  setStats: (s) => set({ stats: s }),
  setRecent: (r) => set({ recent: r }),

  country: '',
  brand: '',
  service: '',
  followUp: false,
  setForm: (patch) => set(patch),

  log: [],
  pushLog: (line) =>
    set((s) => ({ log: [`${new Date().toLocaleTimeString()} — ${line}`, ...s.log].slice(0, 50) })),
  clearLog: () => set({ log: [] }),
}))
