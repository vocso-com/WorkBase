import { create } from 'zustand'

interface SettingsUI {
  open: boolean
  show: () => void
  hide: () => void
}

export const useSettings = create<SettingsUI>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
