import { create } from 'zustand'

interface OnboardingState {
  open: boolean
  show: () => void
  hide: () => void
}

// Controls the first-run / verify-email modal. Opened automatically on first
// launch (no email captured yet) and re-openable from the "verify" nudge.
export const useOnboarding = create<OnboardingState>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
