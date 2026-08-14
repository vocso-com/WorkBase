import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { useNav } from './useNav'
import { useView, type ViewKind } from './useView'
import { useStore } from '../store/useStore'
import { findNode } from '../lib/tree'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'

export interface Tab {
  id: string
  path: string[]
  view: ViewKind
  // The WorkBase this tab belongs to; tabs are scoped per WorkBase.
  workspace: string
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

function activeWs(): string {
  return useStore.getState().doc.activeWorkspace ?? DEFAULT_WORKSPACE_ID
}

// The WorkBase a project belongs to (Home tabs use the active WorkBase).
function wsOf(rootId: string | undefined): string {
  if (!rootId) return activeWs()
  const root = findNode(useStore.getState().doc.roots, rootId)
  return root?.workspace ?? DEFAULT_WORKSPACE_ID
}

interface TabsState {
  tabs: Tab[]
  activeId: string
  // Last active tab per WorkBase, so switching back restores where you were.
  activeByWs: Record<string, string>
  newTab: () => void
  // Open a project. From a Home tab it navigates in place (browser-like);
  // forceNew (⌘/Ctrl-click) always opens a new tab. Re-opening focuses.
  openProject: (rootId: string, forceNew?: boolean) => void
  // Go to the project list — focus a Home tab in the active WorkBase.
  goHome: () => void
  // Switch WorkBase: change the store's active WorkBase and focus one of its tabs.
  switchWorkspace: (wsId: string) => void
  activate: (id: string) => void
  close: (id: string) => void
  reorder: (from: number, to: number) => void
  // Called by the nav/view subscriptions to persist the active tab's location.
  save: (path: string[], view: ViewKind) => void
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: '',
  activeByWs: {},
  newTab: () => {
    const tab: Tab = { id: nanoid(6), path: [], view: 'board', workspace: activeWs() }
    set(s => ({ tabs: [...s.tabs, tab], activeId: tab.id, activeByWs: { ...s.activeByWs, [tab.workspace]: tab.id } }))
    applyTab(tab)
  },
  openProject: (rootId, forceNew = false) => {
    const existing = get().tabs.find(t => t.path[0] === rootId)
    if (existing) { get().activate(existing.id); return }
    const root = findNode(useStore.getState().doc.roots, rootId)
    const view = (root?.view as ViewKind) ?? 'board'
    const ws = root?.workspace ?? DEFAULT_WORKSPACE_ID
    const active = get().tabs.find(t => t.id === get().activeId)
    // From a blank Home tab in this WorkBase, navigate in place; else open a tab.
    if (!forceNew && active && active.path.length === 0 && active.workspace === ws) {
      useNav.getState().set([rootId])
      useView.getState().setView(view)
      return
    }
    const tab: Tab = { id: nanoid(6), path: [rootId], view, workspace: ws }
    set(s => ({ tabs: [...s.tabs, tab], activeId: tab.id, activeByWs: { ...s.activeByWs, [ws]: tab.id } }))
    applyTab(tab)
  },
  goHome: () => {
    const ws = activeWs()
    const home = get().tabs.find(t => t.workspace === ws && t.path.length === 0)
    if (home) { get().activate(home.id); return }
    // No Home tab in this WorkBase — send the current tab back to the project list.
    useNav.getState().set([])
  },
  switchWorkspace: wsId => {
    useStore.getState().setActiveWorkspace(wsId)
    const { tabs, activeByWs } = get()
    const inWs = tabs.filter(t => t.workspace === wsId)
    let target = inWs.find(t => t.id === activeByWs[wsId]) ?? inWs[0]
    if (!target) {
      target = { id: nanoid(6), path: [], view: 'board', workspace: wsId }
      set(s => ({ tabs: [...s.tabs, target as Tab] }))
    }
    set(s => ({ activeId: target!.id, activeByWs: { ...s.activeByWs, [wsId]: target!.id } }))
    applyTab(target)
  },
  activate: id => {
    const tab = get().tabs.find(t => t.id === id)
    if (!tab || id === get().activeId) return
    if (tab.workspace !== activeWs()) useStore.getState().setActiveWorkspace(tab.workspace)
    set(s => ({ activeId: id, activeByWs: { ...s.activeByWs, [tab.workspace]: id } }))
    applyTab(tab)
  },
  close: id => {
    const { tabs, activeId } = get()
    const closing = tabs.find(t => t.id === id)
    if (!closing) return
    const wsTabs = tabs.filter(t => t.workspace === closing.workspace)
    if (wsTabs.length <= 1) return // always keep at least one tab per WorkBase
    const remaining = tabs.filter(t => t.id !== id)
    let nextActive = activeId
    if (activeId === id) {
      const idx = wsTabs.findIndex(t => t.id === id)
      const wsRemaining = wsTabs.filter(t => t.id !== id)
      const neighbor = wsRemaining[Math.min(idx, wsRemaining.length - 1)]
      nextActive = neighbor.id
      applyTab(neighbor)
    }
    set(s => ({ tabs: remaining, activeId: nextActive, activeByWs: { ...s.activeByWs, [closing.workspace]: nextActive } }))
  },
  reorder: (from, to) => {
    if (from === to) return
    set(s => {
      const tabs = [...s.tabs]
      if (from < 0 || from >= tabs.length || to < 0 || to >= tabs.length) return {}
      const [moved] = tabs.splice(from, 1)
      tabs.splice(to, 0, moved)
      return { tabs }
    })
  },
  save: (path, view) => {
    if (applying) return
    set(s => ({ tabs: s.tabs.map(t => (t.id === s.activeId ? { ...t, path, view } : t)) }))
  },
}))

const TABS_KEY = 'wb.tabs'

// Persist the open tabs so a refresh/relaunch restores them instead of
// collapsing back to a single tab.
function persistTabs(s: TabsState) {
  try { localStorage.setItem(TABS_KEY, JSON.stringify({ tabs: s.tabs, activeId: s.activeId })) } catch { /* ignore */ }
}

// Seed the first tab from the current location and keep the active tab synced.
export function initTabs() {
  const st = useTabs.getState()
  if (st.tabs.length === 0) {
    const roots = useStore.getState().doc.roots
    let restored: { tabs: Partial<Tab>[]; activeId: string } | null = null
    try {
      const raw = localStorage.getItem(TABS_KEY)
      if (raw) restored = JSON.parse(raw)
    } catch { /* ignore */ }
    // Keep only tabs whose whole drill path still resolves; tag each with its
    // WorkBase (older saves predate the field).
    const valid = restored?.tabs
      ?.filter(t => Array.isArray(t.path) && t.path!.every(id => findNode(roots, id)))
      .map(t => ({ id: t.id ?? nanoid(6), path: t.path ?? [], view: (t.view ?? 'board') as ViewKind, workspace: t.workspace ?? wsOf(t.path?.[0]) })) as Tab[] | undefined
    if (valid && valid.length) {
      const activeById = valid.some(t => t.id === restored!.activeId) ? restored!.activeId : valid[0].id
      const activeByWs: Record<string, string> = {}
      for (const t of valid) activeByWs[t.workspace] = t.id
      const active = valid.find(t => t.id === activeById)!
      activeByWs[active.workspace] = active.id
      useTabs.setState({ tabs: valid, activeId: activeById, activeByWs })
      if (active.workspace !== activeWs()) useStore.getState().setActiveWorkspace(active.workspace)
      applyTab(active)
    } else {
      const id = nanoid(6)
      const tab: Tab = { id, path: useNav.getState().path, view: useView.getState().view, workspace: activeWs() }
      useTabs.setState({ tabs: [tab], activeId: id, activeByWs: { [tab.workspace]: id } })
    }
  }
  useTabs.subscribe(persistTabs)
  useNav.subscribe(s => useTabs.getState().save(s.path, useView.getState().view))
  useView.subscribe(s => useTabs.getState().save(useNav.getState().path, s.view))

  // Desktop keyboard shortcuts: ⌘/Ctrl+T new tab, ⌘/Ctrl+W close, ⌘/Ctrl+1–9
  // switch (within the active WorkBase).
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', e => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const t = useTabs.getState()
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); t.newTab() }
      else if (e.key === 'w' || e.key === 'W') {
        const ws = activeWs()
        if (t.tabs.filter(x => x.workspace === ws).length > 1) { e.preventDefault(); t.close(t.activeId) }
      } else if (e.key >= '1' && e.key <= '9') {
        const ws = activeWs()
        const tab = t.tabs.filter(x => x.workspace === ws)[Number(e.key) - 1]
        if (tab) { e.preventDefault(); t.activate(tab.id) }
      }
    })
  }
}
