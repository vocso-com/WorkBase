import { create } from 'zustand'

interface NewProjectUI {
  open: boolean
  show: () => void
  hide: () => void
}

export const useNewProject = create<NewProjectUI>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
