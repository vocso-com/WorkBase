import { create } from 'zustand'

interface MyWorkState {
  open: boolean
  show: () => void
  hide: () => void
  toggle: () => void
}

// The execution-engine surface ("My Work"): a workspace-wide view of what to
// do next, derived from tasks + due dates + dependencies.
export const useMyWork = create<MyWorkState>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  toggle: () => set(s => ({ open: !s.open })),
}))
