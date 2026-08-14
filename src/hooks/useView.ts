import { create } from 'zustand'

export type ViewKind = 'board' | 'kanban' | 'flow' | 'columns'

interface ViewState {
  view: ViewKind
  setView: (view: ViewKind) => void
}

export const useView = create<ViewState>(set => ({
  view: 'board',
  setView: view => set({ view }),
}))
