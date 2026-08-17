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
  // Closing onboarding (answered or skipped) is the moment we know the user's
  // type, so it's when a brand-new install seeds its demo. seedIfNeeded is a
  // no-op once seeded or when real data exists, so re-opens are harmless.
  hide: () => {
    set({ open: false })
    void import('../store/useStore').then(m => m.useStore.getState().seedIfNeeded()).catch(() => {})
  },
}))
