import { create } from 'zustand'
import type { StoreDoc, Node, Status, ColorKey } from '../types'
import { pickAdapter, type StorageAdapter } from '../lib/storage'
import { emptyDocument } from '../lib/serialize'
import { newNode } from '../lib/factory'
import { projectPrefix, nextShortId } from '../lib/shortid'
import { addChild, updateNode, deleteNode, moveNode, reorderChildren, findNode } from '../lib/tree'
import { PROJECT_ICONS } from '../theme'
import { sampleDoc } from '../lib/seed'

const SEEDED_KEY = 'manage.seeded'
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

const PALETTE: ColorKey[] = ['blue', 'teal', 'coral', 'violet', 'amber']

interface State {
  doc: StoreDoc
  ready: boolean
  adapter: StorageAdapter
  init: (adapter?: StorageAdapter) => Promise<void>
  addProject: (name: string) => string
  addChildNode: (parentId: string, title: string) => string
  rename: (id: string, title: string) => void
  setStatus: (id: string, status: Status) => void
  toggleDone: (id: string) => void
  patch: (id: string, patch: Partial<Node>) => void
  remove: (id: string) => void
  move: (id: string, newParentId: string | null, index: number) => void
  reorder: (parentId: string | null, from: number, to: number) => void
  replaceDoc: (doc: StoreDoc) => void
}

let timer: ReturnType<typeof setTimeout> | null = null
function schedulePersist(get: () => State) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void get().adapter.save(get().doc) }, 300)
}

let flushListenerAdded = false
function ensureFlushOnUnload(get: () => State) {
  if (flushListenerAdded || typeof window === 'undefined') return
  flushListenerAdded = true
  window.addEventListener('beforeunload', () => {
    if (timer) clearTimeout(timer)
    void get().adapter.save(get().doc)
  })
}

function rootPrefixFor(roots: Node[], id: string): string {
  const root = roots.find(r => r.id === id || findNode(r.children, id))
  return root ? projectPrefix(root.title) : 'X'
}

export const useStore = create<State>((set, get) => ({
  doc: emptyDocument(),
  ready: false,
  adapter: pickAdapter(),
  async init(adapter) {
    const a = adapter ?? get().adapter
    let doc = emptyDocument()
    try {
      doc = await a.load()
    } catch (e) {
      console.error('Manage: failed to load data, starting empty', e)
    }
    if (doc.roots.length === 0 && isTauri() && localStorage.getItem(SEEDED_KEY) !== '1') {
      doc = sampleDoc()
      try {
        await a.save(doc)
        localStorage.setItem(SEEDED_KEY, '1')
      } catch (e) {
        console.error('Manage: failed to persist seed data (showing it in-memory)', e)
      }
    }
    set({ doc, adapter: a, ready: true })
    ensureFlushOnUnload(get)
  },
  addProject(name) {
    const roots = get().doc.roots
    const color = PALETTE[roots.length % PALETTE.length]
    const icon = PROJECT_ICONS[roots.length % PROJECT_ICONS.length]
    const node = newNode(name, { color, icon, status: 'todo' })
    node.shortId = nextShortId(roots, projectPrefix(name))
    set(s => ({ doc: { ...s.doc, roots: addChild(s.doc.roots, null, node) } }))
    schedulePersist(get)
    return node.id
  },
  addChildNode(parentId, title) {
    const node = newNode(title)
    const prefix = rootPrefixFor(get().doc.roots, parentId)
    node.shortId = nextShortId(get().doc.roots, prefix)
    set(s => ({ doc: { ...s.doc, roots: addChild(s.doc.roots, parentId, node) } }))
    schedulePersist(get)
    return node.id
  },
  rename(id, title) { get().patch(id, { title }) },
  setStatus(id, status) { get().patch(id, { status }) },
  toggleDone(id) {
    const n = findNode(get().doc.roots, id)
    get().patch(id, { status: n && n.status === 'done' ? 'todo' : 'done' })
  },
  patch(id, patch) {
    const stamped = { ...patch, updatedAt: new Date().toISOString() }
    set(s => ({ doc: { ...s.doc, roots: updateNode(s.doc.roots, id, stamped) } }))
    schedulePersist(get)
  },
  remove(id) {
    set(s => ({ doc: { ...s.doc, roots: deleteNode(s.doc.roots, id) } }))
    schedulePersist(get)
  },
  move(id, newParentId, index) {
    set(s => ({ doc: { ...s.doc, roots: moveNode(s.doc.roots, id, newParentId, index) } }))
    schedulePersist(get)
  },
  reorder(parentId, from, to) {
    set(s => ({ doc: { ...s.doc, roots: reorderChildren(s.doc.roots, parentId, from, to) } }))
    schedulePersist(get)
  },
  replaceDoc(doc) {
    set({ doc })
    schedulePersist(get)
  },
}))
