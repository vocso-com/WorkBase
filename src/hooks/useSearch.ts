import { create } from 'zustand'

interface SearchState {
  open: boolean
  show: () => void
  hide: () => void
  toggle: () => void
}

// The ⌘K / Ctrl+K quick-switcher: search + jump anywhere in the local workspace.
export const useSearch = create<SearchState>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  toggle: () => set(s => ({ open: !s.open })),
}))
