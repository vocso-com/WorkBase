import { create } from 'zustand'

interface Nav {
  path: string[]
  open: (id: string) => void
  goto: (index: number) => void
  home: () => void
}

export const useNav = create<Nav>(set => ({
  path: [],
  open: id => set(s => ({ path: [...s.path, id] })),
  goto: index => set(s => ({ path: s.path.slice(0, index + 1) })),
  home: () => set({ path: [] }),
}))
