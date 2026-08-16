import { create } from 'zustand'

interface AboutState {
  open: boolean
  show: () => void
  hide: () => void
}

export const useAbout = create<AboutState>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
