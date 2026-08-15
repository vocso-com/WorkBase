import { useNav } from '../hooks/useNav'
import { useView, type ViewKind } from '../hooks/useView'
import { useTabs } from '../hooks/useTabs'
import { useStore } from '../store/useStore'
import { findNode } from './tree'

const MYWORK_HASH = '#/~mywork'

function activeTabIsMyWork(): boolean {
  const s = useTabs.getState()
  return s.tabs.find(t => t.id === s.activeId)?.kind === 'mywork'
}

const VIEWS: ViewKind[] = ['board', 'kanban', 'flow', 'columns']

export function parseHash(hash: string): { path: string[]; view: ViewKind } {
  const body = hash.replace(/^#\/?/, '')
  const [pathPart, query = ''] = body.split('?')
  const path = pathPart.split('/').filter(Boolean)
  const m = /view=([a-z]+)/.exec(query)
  const view = m && (VIEWS as string[]).includes(m[1]) ? (m[1] as ViewKind) : 'board'
  return { path, view }
}

export function buildHash(path: string[], view: ViewKind): string {
  return path.length === 0 ? '#/' : `#/${path.join('/')}?view=${view}`
}

/**
 * Apply a hash to app state, keeping only node ids that still exist.
 * On the initial load a `#/~mywork` hash is left to the tab restore (which
 * re-opens the persisted My Work tab); on later hashchange it opens My Work.
 */
function applyHash(hash: string, initial = false) {
  if (hash.replace(/\/$/, '') === MYWORK_HASH) {
    if (!initial) useTabs.getState().openMyWork()
    return
  }
  const { path, view } = parseHash(hash)
  const roots = useStore.getState().doc.roots
  const valid = path.length > 0 && path.every(id => findNode(roots, id))
  if (valid) useNav.getState().set(path)
  else useNav.getState().home()
  useView.getState().setView(view)
}

/**
 * Two-way sync between the URL hash and nav/view state so a refresh restores
 * the exact location (project → module → view). Call once after the store loads.
 */
export function initRouter() {
  if (typeof window === 'undefined') return
  applyHash(window.location.hash, true)

  const write = () => {
    const h = activeTabIsMyWork() ? MYWORK_HASH : buildHash(useNav.getState().path, useView.getState().view)
    if (window.location.hash !== h) window.location.hash = h
  }
  useNav.subscribe(write)
  useView.subscribe(write)
  // Switching between same-path tabs (Home ↔ My Work) doesn't change nav, so
  // track the active tab too.
  useTabs.subscribe(write)
  window.addEventListener('hashchange', () => applyHash(window.location.hash))
  write()
}
