import { create } from 'zustand'

interface DetailState {
  openId: string | null
  open: (id: string) => void
  close: () => void
}

export const useDetail = create<DetailState>(set => ({
  openId: null,
  open: id => set({ openId: id }),
  close: () => set({ openId: null }),
}))
