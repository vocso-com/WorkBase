import { useNav } from '../hooks/useNav'
import { useView, type ViewKind } from '../hooks/useView'
import { useStore } from '../store/useStore'
import { findNode } from './tree'

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

/** Apply a hash to app state, keeping only node ids that still exist. */
function applyHash(hash: string) {
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
  applyHash(window.location.hash)

  const write = () => {
    const h = buildHash(useNav.getState().path, useView.getState().view)
    if (window.location.hash !== h) window.location.hash = h
  }
  useNav.subscribe(write)
  useView.subscribe(write)
  window.addEventListener('hashchange', () => applyHash(window.location.hash))
  write()
}
