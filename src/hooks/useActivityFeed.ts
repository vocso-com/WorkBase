import { create } from 'zustand'

interface ActivityFeedState {
  open: boolean
  show: () => void
  hide: () => void
  toggle: () => void
}

// The subtle global activity feed drawer.
export const useActivityFeed = create<ActivityFeedState>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  toggle: () => set(s => ({ open: !s.open })),
}))
