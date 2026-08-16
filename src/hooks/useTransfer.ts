import { create } from 'zustand'

interface TransferState {
  /** The whole-account backup dialog. */
  accountExport: boolean
  importOpen: boolean
  showAccountExport: () => void
  hideAccountExport: () => void
  showImport: () => void
  hideImport: () => void
}

/** Which account-level transfer dialog is open. Never both at once. */
export const useTransfer = create<TransferState>(set => ({
  accountExport: false,
  importOpen: false,
  showAccountExport: () => set({ accountExport: true, importOpen: false }),
  hideAccountExport: () => set({ accountExport: false }),
  showImport: () => set({ importOpen: true, accountExport: false }),
  hideImport: () => set({ importOpen: false }),
}))
