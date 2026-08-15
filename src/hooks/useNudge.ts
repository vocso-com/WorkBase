import { create } from 'zustand'

interface NudgeState {
  closed: boolean
  close: () => void
  reopen: () => void
}

// Session-only dismissal for the desktop nudge widget (returns on relaunch).
export const useNudge = create<NudgeState>(set => ({
  closed: false,
  close: () => set({ closed: true }),
  reopen: () => set({ closed: false }),
}))
