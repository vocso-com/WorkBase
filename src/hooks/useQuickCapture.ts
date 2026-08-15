import { create } from 'zustand'

interface QuickCaptureState {
  open: boolean
  show: () => void
  hide: () => void
}

// Lightweight quick-capture palette (opened from the reminder widget's + or a
// shortcut) for jotting a task with a natural-language due date.
export const useQuickCapture = create<QuickCaptureState>(set => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}))
