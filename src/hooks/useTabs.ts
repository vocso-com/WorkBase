import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { useNav } from './useNav'
import { useView, type ViewKind } from './useView'
import { useStore } from '../store/useStore'
import { findNode } from '../lib/tree'

export interface Tab {
  id: string
  path: string[]
  view: ViewKind
}

// True while we're pushing a tab's saved location into nav/view, so the
// nav/view subscriptions don't clobber the tab we're restoring.
let applying = false

function applyTab(tab: Tab) {
  applying = true
  useNav.getState().set(tab.path)
  useView.getState().setView(tab.view)
  applying = false
}

interface TabsState {
  tabs: Tab[]
  activeId: string
  newTab: () => void
  // Open a project in its own tab (focus it if already open).
  openProject: (rootId: string) => void
  // Focus a blank/home tab, creating one if none is open.
  goHome: () => void
  activate: (id: string) => void
  close: (id: string) => void
  // Called by the nav/view subscriptions to persist the active tab's location.
  save: (path: string[], view: ViewKind) => void
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: '',
  newTab: () => {
    const tab: Tab = { id: nanoid(6), path: [], view: 'board' }
    set(s => ({ tabs: [...s.tabs, tab], activeId: tab.id }))
    applyTab(tab)
  },
  openProject: rootId => {
    const existing = get().tabs.find(t => t.path[0] === rootId)
    if (existing) { get().activate(existing.id); return }
    const root = findNode(useStore.getState().doc.roots, rootId)
    const view = (root?.view as ViewKind) ?? 'board'
    const tab: Tab = { id: nanoid(6), path: [rootId], view }
    set(s => ({ tabs: [...s.tabs, tab], activeId: tab.id }))
    applyTab(tab)
  },
  goHome: () => {
    const home = get().tabs.find(t => t.path.length === 0)
    if (home) { get().activate(home.id); return }
    get().newTab()
  },
  activate: id => {
    const tab = get().tabs.find(t => t.id === id)
    if (!tab || id === get().activeId) return
    set({ activeId: id })
    applyTab(tab)
  },
  close: id => {
    const { tabs, activeId } = get()
    if (tabs.length <= 1) return
    const idx = tabs.findIndex(t => t.id === id)
    const remaining = tabs.filter(t => t.id !== id)
    let nextActive = activeId
    if (activeId === id) {
      const neighbor = remaining[Math.min(idx, remaining.length - 1)]
      nextActive = neighbor.id
      applyTab(neighbor)
    }
    set({ tabs: remaining, activeId: nextActive })
  },
  save: (path, view) => {
    if (applying) return
    set(s => ({ tabs: s.tabs.map(t => (t.id === s.activeId ? { ...t, path, view } : t)) }))
  },
}))

// Seed the first tab from the current location and keep the active tab synced.
export function initTabs() {
  const st = useTabs.getState()
  if (st.tabs.length === 0) {
    const id = nanoid(6)
    useTabs.setState({ tabs: [{ id, path: useNav.getState().path, view: useView.getState().view }], activeId: id })
  }
  useNav.subscribe(s => useTabs.getState().save(s.path, useView.getState().view))
  useView.subscribe(s => useTabs.getState().save(useNav.getState().path, s.view))
}
