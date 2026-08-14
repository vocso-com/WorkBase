import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { StoreDoc, Node, Status, ColorKey, Template } from '../types'
import { pickAdapter, type StorageAdapter } from '../lib/storage'
import { emptyDocument, DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { newNode } from '../lib/factory'
import { projectPrefix, nextShortId } from '../lib/shortid'
import { addChild, updateNode, deleteNode, moveNode, reorderChildren, findNode, findParent } from '../lib/tree'
import { instantiateTemplate, projectToTemplate } from '../lib/templates'
import { PROJECT_ICONS, mergedStages } from '../theme'
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
  addProjectFromTemplate: (tpl: Template, name?: string) => string
  addWorkspace: (name: string) => string
  renameWorkspace: (id: string, name: string) => void
  deleteWorkspace: (id: string) => void
  setActiveWorkspace: (id: string) => void
  saveAsTemplate: (nodeId: string) => string | null
  deleteTemplate: (id: string) => void
  addChildNode: (parentId: string, title: string) => string
  logActivity: (id: string, text: string) => void
  rename: (id: string, title: string) => void
  setStatus: (id: string, status: Status) => void
  toggleDone: (id: string) => void
  patch: (id: string, patch: Partial<Node>) => void
  addTag: (name: string, color: ColorKey) => void
  addComment: (id: string, text: string) => void
  removeComment: (id: string, commentId: string) => void
  addAttachment: (id: string, file: { name: string; type: string; dataUrl: string }) => void
  removeAttachment: (id: string, attId: string) => void
  setPos: (id: string, pos: { x: number; y: number } | undefined) => void
  clearPositions: (rootId: string) => void
  setCollapsed: (id: string, collapsed: boolean) => void
  setCollapsedAll: (rootId: string, collapsed: boolean) => void
  addStage: (label: string, color: ColorKey) => string
  removeStage: (id: string) => void
  renameStage: (id: string, label: string) => void
  setProfile: (patch: Partial<StoreDoc['profile']>) => void
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
    node.workspace = get().doc.activeWorkspace
    set(s => ({ doc: { ...s.doc, roots: addChild(s.doc.roots, null, node) } }))
    schedulePersist(get)
    return node.id
  },
  addProjectFromTemplate(tpl, name) {
    const roots = get().doc.roots
    const root = instantiateTemplate(tpl, roots, name)
    root.workspace = get().doc.activeWorkspace
    set(s => ({ doc: { ...s.doc, roots: [...s.doc.roots, root] } }))
    schedulePersist(get)
    return root.id
  },
  addWorkspace(name) {
    const id = `ws-${nanoid(6)}`
    const color = PALETTE[get().doc.workspaces.length % PALETTE.length]
    set(s => ({ doc: { ...s.doc, workspaces: [...s.doc.workspaces, { id, name: name.trim() || 'New WorkBase', icon: 'ti-stack-2', color }], activeWorkspace: id } }))
    schedulePersist(get)
    return id
  },
  renameWorkspace(id, name) {
    set(s => ({ doc: { ...s.doc, workspaces: s.doc.workspaces.map(w => (w.id === id ? { ...w, name: name.trim() || w.name } : w)) } }))
    schedulePersist(get)
  },
  setActiveWorkspace(id) {
    set(s => ({ doc: { ...s.doc, activeWorkspace: id } }))
    schedulePersist(get)
  },
  deleteWorkspace(id) {
    const ws = get().doc.workspaces
    if (ws.length <= 1) return
    const fallback = ws.find(w => w.id !== id)!.id
    set(s => {
      // Reassign this WorkBase's projects to the fallback — no data loss.
      const roots = s.doc.roots.map(r => ((r.workspace ?? DEFAULT_WORKSPACE_ID) === id ? { ...r, workspace: fallback } : r))
      const workspaces = s.doc.workspaces.filter(w => w.id !== id)
      const activeWorkspace = s.doc.activeWorkspace === id ? fallback : s.doc.activeWorkspace
      return { doc: { ...s.doc, roots, workspaces, activeWorkspace } }
    })
    schedulePersist(get)
  },
  saveAsTemplate(nodeId) {
    const node = findNode(get().doc.roots, nodeId)
    if (!node) return null
    // Upsert by name so "Update template" replaces rather than duplicates.
    const existing = get().doc.templates.find(t => t.name === node.title)
    const tpl = projectToTemplate(node, existing?.id ?? `tpl-${nanoid(8)}`)
    set(s => ({
      doc: {
        ...s.doc,
        templates: existing ? s.doc.templates.map(t => (t.id === existing.id ? tpl : t)) : [...s.doc.templates, tpl],
      },
    }))
    schedulePersist(get)
    return tpl.id
  },
  deleteTemplate(id) {
    set(s => ({ doc: { ...s.doc, templates: s.doc.templates.filter(t => t.id !== id) } }))
    schedulePersist(get)
  },
  addChildNode(parentId, title) {
    const node = newNode(title)
    const prefix = rootPrefixFor(get().doc.roots, parentId)
    node.shortId = nextShortId(get().doc.roots, prefix)
    set(s => ({ doc: { ...s.doc, roots: addChild(s.doc.roots, parentId, node) } }))
    get().logActivity(parentId, `Added “${title.trim()}”`)
    schedulePersist(get)
    return node.id
  },
  logActivity(id, text) {
    const n = findNode(get().doc.roots, id)
    if (!n) return
    const entry = { id: nanoid(), text, at: new Date().toISOString() }
    const activities = [...(n.activities ?? []), entry].slice(-60)
    set(s => ({ doc: { ...s.doc, roots: updateNode(s.doc.roots, id, { activities }) } }))
    schedulePersist(get)
  },
  rename(id, title) { get().patch(id, { title }) },
  setStatus(id, status) {
    const n = findNode(get().doc.roots, id)
    get().patch(id, { status })
    if (n && n.status !== status) {
      const label = mergedStages(get().doc.stages).find(st => st.id === status)?.label ?? status
      get().logActivity(id, `Moved to ${label}`)
    }
  },
  toggleDone(id) {
    const n = findNode(get().doc.roots, id)
    if (!n) return
    const done = n.status === 'done'
    get().patch(id, { status: done ? 'todo' : 'done' })
    // Log on the checklist owner (parent) so ticking an item shows in its card,
    // and on the item itself for its own history.
    const verb = done ? 'Unchecked' : 'Checked'
    const parent = findParent(get().doc.roots, id)
    if (parent) get().logActivity(parent.id, `${verb} “${n.title}”`)
    get().logActivity(id, done ? 'Marked not done' : 'Marked complete')
  },
  patch(id, patch) {
    const stamped = { ...patch, updatedAt: new Date().toISOString() }
    set(s => ({ doc: { ...s.doc, roots: updateNode(s.doc.roots, id, stamped) } }))
    schedulePersist(get)
  },
  addTag(name, color) {
    const n = name.trim()
    if (!n) return
    if (get().doc.tagPalette.some(t => t.name.toLowerCase() === n.toLowerCase())) return
    set(s => ({ doc: { ...s.doc, tagPalette: [...s.doc.tagPalette, { name: n, color }] } }))
    schedulePersist(get)
  },
  addComment(id, text) {
    const t = text.trim()
    if (!t) return
    const n = findNode(get().doc.roots, id)
    const comment = { id: nanoid(), text: t, at: new Date().toISOString() }
    get().patch(id, { comments: [...(n?.comments ?? []), comment] })
  },
  removeComment(id, commentId) {
    const n = findNode(get().doc.roots, id)
    get().patch(id, { comments: (n?.comments ?? []).filter(c => c.id !== commentId) })
  },
  addAttachment(id, file) {
    const n = findNode(get().doc.roots, id)
    const att = { id: nanoid(), name: file.name, type: file.type, dataUrl: file.dataUrl, at: new Date().toISOString() }
    get().patch(id, { attachments: [...(n?.attachments ?? []), att] })
    get().logActivity(id, `Attached “${file.name}”`)
  },
  removeAttachment(id, attId) {
    const n = findNode(get().doc.roots, id)
    get().patch(id, { attachments: (n?.attachments ?? []).filter(a => a.id !== attId) })
  },
  setPos(id, pos) {
    get().patch(id, { pos })
  },
  clearPositions(rootId) {
    const root = findNode(get().doc.roots, rootId)
    if (!root) return
    const ids: string[] = []
    const walk = (n: Node) => { ids.push(n.id); n.children.forEach(walk) }
    walk(root)
    set(s => {
      let roots = s.doc.roots
      for (const nid of ids) roots = updateNode(roots, nid, { pos: undefined })
      return { doc: { ...s.doc, roots } }
    })
    schedulePersist(get)
  },
  setCollapsed(id, collapsed) {
    get().patch(id, { collapsed })
  },
  setCollapsedAll(rootId, collapsed) {
    const root = findNode(get().doc.roots, rootId)
    if (!root) return
    const updates: { id: string; collapsed: boolean }[] = []
    const walk = (n: Node, depth: number) => {
      // Root stays expanded; descendants take the requested state.
      updates.push({ id: n.id, collapsed: depth === 0 ? false : collapsed })
      n.children.forEach(c => walk(c, depth + 1))
    }
    walk(root, 0)
    set(s => {
      let roots = s.doc.roots
      for (const u of updates) roots = updateNode(roots, u.id, { collapsed: u.collapsed })
      return { doc: { ...s.doc, roots } }
    })
    schedulePersist(get)
  },
  addStage(label, color) {
    const id = `stage-${nanoid(6)}`
    set(s => ({ doc: { ...s.doc, stages: [...s.doc.stages, { id, label: label.trim() || 'New stage', color }] } }))
    schedulePersist(get)
    return id
  },
  renameStage(id, label) {
    set(s => ({ doc: { ...s.doc, stages: s.doc.stages.map(st => (st.id === id ? { ...st, label } : st)) } }))
    schedulePersist(get)
  },
  setProfile(patch) {
    set(s => ({ doc: { ...s.doc, profile: { ...(s.doc.profile ?? {}), ...patch } } }))
    schedulePersist(get)
  },
  removeStage(id) {
    set(s => {
      // Reassign any tasks currently in this stage back to "To do".
      let roots = s.doc.roots
      const orphaned: string[] = []
      const walk = (n: Node) => { if (n.status === id) orphaned.push(n.id); n.children.forEach(walk) }
      roots.forEach(walk)
      for (const nid of orphaned) roots = updateNode(roots, nid, { status: 'todo' })
      return { doc: { ...s.doc, roots, stages: s.doc.stages.filter(st => st.id !== id) } }
    })
    schedulePersist(get)
  },
  remove(id) {
    const roots = get().doc.roots
    const n = findNode(roots, id)
    const parent = n ? findParent(roots, id) : null
    set(s => ({ doc: { ...s.doc, roots: deleteNode(s.doc.roots, id) } }))
    // Log the removal on the surviving parent so it shows in its activity feed.
    if (n && parent) get().logActivity(parent.id, `Removed “${n.title}”`)
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
