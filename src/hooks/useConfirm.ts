import { create } from 'zustand'

export interface ConfirmOpts {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  // An optional second way to say yes, sitting between Cancel and the primary
  // action — for prompts where "do it" has two reasonable meanings.
  altLabel?: string
  onAlt?: () => void
}

interface ConfirmState {
  current: ConfirmOpts | null
  ask: (o: ConfirmOpts) => void
  close: () => void
}

export const useConfirm = create<ConfirmState>(set => ({
  current: null,
  ask: o => set({ current: o }),
  close: () => set({ current: null }),
}))

/** Imperative helper: askConfirm({ message, onConfirm }). */
export function askConfirm(o: ConfirmOpts): void {
  useConfirm.getState().ask(o)
}
