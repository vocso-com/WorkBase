import { create } from 'zustand'

interface TransferState {
  /** Id of the project the export dialog is for; null when closed. */
  exportFor: string | null
  importOpen: boolean
  showExport: (nodeId: string) => void
  hideExport: () => void
  showImport: () => void
  hideImport: () => void
}

/** Which transfer dialog is open. Export and Import are never both up. */
export const useTransfer = create<TransferState>(set => ({
  exportFor: null,
  importOpen: false,
  showExport: nodeId => set({ exportFor: nodeId, importOpen: false }),
  hideExport: () => set({ exportFor: null }),
  showImport: () => set({ importOpen: true, exportFor: null }),
  hideImport: () => set({ importOpen: false }),
}))
