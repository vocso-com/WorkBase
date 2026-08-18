import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { StoreDoc, Node, Status, ColorKey, Template, SizeKey } from '../types'
import { pickAdapter, type StorageAdapter } from '../lib/storage'
import { emptyDocument, DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { mergeProjectExport, type ProjectExport } from '../lib/export/json'
import { applyImport as applyImportPlan, type ParsedImport, type ImportCandidate } from '../lib/export/importPlan'
import { newNode } from '../lib/factory'
import { projectPrefix, nextShortId } from '../lib/shortid'
import { addChild, updateNode, deleteNode, deleteKeepingChildren, moveNode, reorderChildren, findNode, findParent, pathTo } from '../lib/tree'
import { wouldCycle, dependents } from '../lib/deps'
import { totalScope } from '../lib/scope'
import { instantiateTemplate, projectToTemplate } from '../lib/templates'
import { playComplete } from '../lib/sound'
import { PROJECT_ICONS, mergedStages } from '../theme'
import { sampleDoc } from '../lib/seed'
import { demoBucket } from '../lib/demoBucket'
import { fetchCatalog, fetchTemplate } from '../lib/directory'

const SEEDED_KEY = 'manage.seeded'

const PALETTE: ColorKey[] = ['blue', 'teal', 'coral', 'violet', 'amber']

interface State {
  doc: StoreDoc
  ready: boolean
  adapter: StorageAdapter
  init: (adapter?: StorageAdapter) => Promise<void>
  seedIfNeeded: () => Promise<void>
  addProject: (name: string) => string
  addProjectFromTemplate: (tpl: Template, name?: string) => string
  importProject: (exp: ProjectExport) => string
  applyImport: (parsed: ParsedImport, decisions: ImportCandidate[]) => { added: number; updated: number; ignored: number; openId?: string }
  addWorkspace: (name: string) => string
  renameWorkspace: (id: string, name: string) => void
  deleteWorkspace: (id: string) => void
  setActiveWorkspace: (id: string) => void
  saveAsTemplate: (nodeId: string) => string | null
  deleteTemplate: (id: string) => void
  addChildNode: (parentId: string, title: string) => string
  quickAddTask: (title: string, dueDate?: string, targetId?: string) => string
  logActivity: (id: string, text: string) => void
  rename: (id: string, title: string) => void
  setStatus: (id: string, status: Status) => void
  toggleDone: (id: string) => void
  completeSubtree: (id: string) => void
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
  moveStageTo: (id: string, beforeId: string | null) => void
  setSize: (id: string, size: SizeKey | undefined) => void
  setProfile: (patch: Partial<StoreDoc['profile']>) => void
  addDependency: (id: string, dependsOnId: string) => boolean
  removeDependency: (id: string, dependsOnId: string) => void
  remove: (id: string) => void
  removeKeepingChildren: (id: string) => void
  duplicate: (id: string) => string | null
  move: (id: string, newParentId: string | null, index: number) => void
  reorder: (parentId: string | null, from: number, to: number) => void
  replaceDoc: (doc: StoreDoc) => void
  reload: () => Promise<void>
}

// The reminder widget runs in a second window that shares the same data file.
// To avoid two writers racing (a stale widget save clobbering the main window's
// edits), the widget NEVER persists — it routes its changes to the main window,
// the single source of truth.
function isWidgetWindow(): boolean {
  return typeof window !== 'undefined' && (window as unknown as { __WB_WIDGET__?: boolean }).__WB_WIDGET__ === true
}

let timer: ReturnType<typeof setTimeout> | null = null
function schedulePersist(get: () => State) {
  if (isWidgetWindow()) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void get().adapter.save(get().doc) }, 300)
}

let flushListenerAdded = false
function ensureFlushOnUnload(get: () => State) {
  if (flushListenerAdded || typeof window === 'undefined' || isWidgetWindow()) return
  flushListenerAdded = true
  window.addEventListener('beforeunload', () => {
    if (timer) clearTimeout(timer)
    void get().adapter.save(get().doc)
  })
}

/**
 * A project's scope at the moment work first starts on it — its kickoff.
 *
 * Captured once and never revised, so "scope has grown 40% since kickoff" means
 * something. Growing the plan afterwards is exactly what we want to measure,
 * not something that should quietly move the goalposts.
 */
function captureBaseline(get: () => State, set: (fn: (s: State) => Partial<State>) => void, id: string): void {
  const roots = get().doc.roots
  const rootId = pathTo(roots, id)[0]
  if (!rootId) return
  const root = findNode(roots, rootId)
  if (!root || root.baselineWeight) return
  const patch = { baselineWeight: totalScope(root), baselineAt: new Date().toISOString() }
  set(s => ({ doc: { ...s.doc, roots: updateNode(s.doc.roots, rootId, patch) } }))
}

/**
 * Starting work on a task means its module and project are underway, so any
 * ancestor still sitting in "To do" moves to "In progress".
 *
 * Deliberately silent rather than a prompt: there is only one sensible answer,
 * and asking on every first tick in every project is friction for no decision.
 * It matters because Projects Home groups by status — a project with work
 * happening inside it does not belong in the To do lane.
 *
 * Only ever fires *from* `todo`, so an explicit Blocked, Done or custom stage is
 * never overridden by activity underneath it.
 */
function promoteAncestors(get: () => State, set: (fn: (s: State) => Partial<State>) => void, id: string): void {
  const roots = get().doc.roots
  const stale = pathTo(roots, id)
    .slice(0, -1)
    .map(aid => findNode(roots, aid))
    .filter((n): n is Node => !!n && n.status === 'todo')
  if (stale.length === 0) return

  const updatedAt = new Date().toISOString()
  set(s => {
    let next = s.doc.roots
    for (const n of stale) next = updateNode(next, n.id, { status: 'doing', updatedAt })
    return { doc: { ...s.doc, roots: next } }
  })
  for (const n of stale) get().logActivity(n.id, 'Moved to In progress — work started inside')
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
    set({ doc, adapter: a, ready: true })
    ensureFlushOnUnload(get)
    // A returning user whose workspace is empty but who has already onboarded
    // gets their demo now. A brand-new user is seeded when onboarding resolves,
    // once we know their user type (see seedIfNeeded / OnboardingModal).
    if (doc.roots.length === 0 && !!doc.profile?.userEmail) void get().seedIfNeeded()
  },

  /**
   * Seed a first-run demo project once, keyed to the user's type. Prefers a
   * hosted demo for their bucket (fetched when online), and always falls back
   * to the bundled sample so a fresh install is never an empty screen. Never
   * overwrites real data, and runs at most once (guarded by SEEDED_KEY).
   */
  async seedIfNeeded() {
    if (get().doc.roots.length > 0) return
    if (localStorage.getItem(SEEDED_KEY) === '1') return
    const profile = get().doc.profile
    const bucket = demoBucket(profile?.userType)

    let seeded: StoreDoc | null = null
    try {
      const cat = await fetchCatalog(profile?.userEmail)
      const demos = (cat?.templates ?? []).filter(t => t.kind === 'demo' && !t.locked)
      const pick = demos.find(t => t.demo_for === bucket) ?? demos.find(t => t.demo_for === 'personal')
      if (pick) {
        const tpl = await fetchTemplate(pick.id, pick.version, profile?.userEmail)
        const base = emptyDocument()
        base.profile = profile
        const root = instantiateTemplate(tpl, base.roots)
        root.workspace = base.activeWorkspace
        base.roots.push(root)
        seeded = base
      }
    } catch { /* offline or no directory — fall back to the bundled sample */ }

    if (!seeded) {
      seeded = sampleDoc()
      seeded.profile = profile // keep the profile captured during onboarding
    }
    // Re-check after the awaits, so we never clobber data that arrived meanwhile.
    if (get().doc.roots.length > 0) return
    try {
      await get().adapter.save(seeded)
      localStorage.setItem(SEEDED_KEY, '1')
    } catch (e) {
      console.error('Manage: failed to persist seed data (showing it in-memory)', e)
    }
    set({ doc: seeded })
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
  quickAddTask(title, dueDate, targetId) {
    // Explicit destination wins; otherwise land in the WorkBase's Inbox project
    // (created on first use).
    let parentId = targetId && findNode(get().doc.roots, targetId) ? targetId : ''
    if (!parentId) {
      const ws = get().doc.activeWorkspace
      const existing = get().doc.roots.find(r => r.title === 'Inbox' && (r.workspace ?? DEFAULT_WORKSPACE_ID) === ws)
      parentId = existing ? existing.id : get().addProject('Inbox')
      if (!existing) get().patch(parentId, { icon: 'ti-inbox' })
    }
    const id = get().addChildNode(parentId, title)
    if (dueDate) get().patch(id, { dueDate })
    return id
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
    if (status !== 'todo') promoteAncestors(get, set, id)
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
    // Only on the way to done — un-ticking is not "starting work".
    if (!done) promoteAncestors(get, set, id)
    if (!done && get().doc.profile?.soundsEnabled !== false) playComplete()
  },
  /**
   * Mark a node and everything under it done, in one write. Applied as a single
   * batched update (like setCollapsedAll) rather than a toggleDone per node, so
   * a large subtree is one render and one persist — and because toggleDone
   * would *un*-complete descendants that were already done.
   */
  /** Apply an import dialog's decisions: add, update or skip each project. */
  applyImport(parsed, decisions) {
    const out = applyImportPlan(get().doc, parsed, decisions)
    set({ doc: out.doc })
    schedulePersist(get)
    return { added: out.added, updated: out.updated, ignored: out.ignored, openId: out.openId }
  },
  /** Add an exported project to this document and return its new root id. */
  importProject(exp) {
    const next = mergeProjectExport(get().doc, exp)
    const root = next.roots[next.roots.length - 1]
    set({ doc: next })
    schedulePersist(get)
    return root.id
  },
  completeSubtree(id) {
    const root = findNode(get().doc.roots, id)
    if (!root) return
    const ids: string[] = []
    const walk = (n: Node) => { if (n.status !== 'done') ids.push(n.id); n.children.forEach(walk) }
    walk(root)
    if (ids.length === 0) return
    const updatedAt = new Date().toISOString()
    set(s => {
      let roots = s.doc.roots
      for (const nid of ids) roots = updateNode(roots, nid, { status: 'done', updatedAt })
      return { doc: { ...s.doc, roots } }
    })
    promoteAncestors(get, set, id)
    const others = ids.length - (root.status === 'done' ? 0 : 1)
    get().logActivity(id, others > 0 ? `Marked complete with ${others} sub-item${others === 1 ? '' : 's'}` : 'Marked complete')
    if (get().doc.profile?.soundsEnabled !== false) playComplete()
    schedulePersist(get)
  },
  patch(id, patch) {
    const now = new Date().toISOString()
    const stamped: Partial<Node> = { ...patch, updatedAt: now }
    // Completion is dated so weights can be learned from real history later.
    // The activity log already records the transition, so clearing on un-done
    // loses nothing and keeps this field bounded.
    if (patch.status !== undefined) {
      stamped.completedAt = patch.status === 'done' ? now : undefined
    }
    set(s => ({ doc: { ...s.doc, roots: updateNode(s.doc.roots, id, stamped) } }))
    if (patch.status !== undefined && patch.status !== 'todo') captureBaseline(get, set, id)
    schedulePersist(get)
  },
  setSize(id, size) {
    get().patch(id, { size })
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
    const clean = label.trim()
    set(s => {
      // Store the new label as an override so built-in stages (To do, Done, …)
      // can be renamed too, without touching their status ids.
      const stageLabels = { ...(s.doc.stageLabels ?? {}) }
      if (clean) stageLabels[id] = clean
      else delete stageLabels[id]
      // Keep a custom stage's own label in sync for exports/back-compat.
      const stages = s.doc.stages.map(st => (st.id === id && clean ? { ...st, label: clean } : st))
      return { doc: { ...s.doc, stages, stageLabels } }
    })
    schedulePersist(get)
  },
  moveStageTo(id, beforeId) {
    set(s => {
      const order = mergedStages(s.doc.stages, s.doc.stageLabels, s.doc.stageOrder).map(st => st.id)
      if (!order.includes(id)) return s
      const without = order.filter(x => x !== id)
      let at = beforeId ? without.indexOf(beforeId) : without.length
      if (at === -1) at = without.length
      without.splice(at, 0, id)
      return { doc: { ...s.doc, stageOrder: without } }
    })
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
  addDependency(id, dependsOnId) {
    const roots = get().doc.roots
    const n = findNode(roots, id)
    if (!n || id === dependsOnId) return false
    if ((n.dependsOn ?? []).includes(dependsOnId)) return false
    if (wouldCycle(roots, id, dependsOnId)) return false
    get().patch(id, { dependsOn: [...(n.dependsOn ?? []), dependsOnId] })
    const dep = findNode(roots, dependsOnId)
    get().logActivity(id, `Blocked by “${dep?.title ?? 'item'}”`)
    return true
  },
  removeDependency(id, dependsOnId) {
    const n = findNode(get().doc.roots, id)
    if (!n) return
    get().patch(id, { dependsOn: (n.dependsOn ?? []).filter(d => d !== dependsOnId) })
  },
  remove(id) {
    const roots = get().doc.roots
    const n = findNode(roots, id)
    const parent = n ? findParent(roots, id) : null
    // Strip the deleted id from any node that was blocked by it.
    const blockers = dependents(roots, id)
    set(s => {
      let roots2 = deleteNode(s.doc.roots, id)
      for (const d of blockers) roots2 = updateNode(roots2, d.id, { dependsOn: (d.dependsOn ?? []).filter(x => x !== id) })
      return { doc: { ...s.doc, roots: roots2 } }
    })
    // Log the removal on the surviving parent so it shows in its activity feed.
    if (n && parent) get().logActivity(parent.id, `Removed “${n.title}”`)
    schedulePersist(get)
  },
  removeKeepingChildren(id) {
    const roots = get().doc.roots
    const n = findNode(roots, id)
    const parent = n ? findParent(roots, id) : null
    const blockers = dependents(roots, id)
    set(s => {
      let roots2 = deleteKeepingChildren(s.doc.roots, id)
      for (const d of blockers) roots2 = updateNode(roots2, d.id, { dependsOn: (d.dependsOn ?? []).filter(x => x !== id) })
      return { doc: { ...s.doc, roots: roots2 } }
    })
    if (n && parent) get().logActivity(parent.id, `Removed “${n.title}”, kept its sub-items`)
    schedulePersist(get)
  },
  duplicate(id) {
    const roots = get().doc.roots
    const node = findNode(roots, id)
    if (!node) return null
    const parent = findParent(roots, id)
    const parentId = parent ? parent.id : null
    const prefix = parentId === null ? projectPrefix(node.title) : rootPrefixFor(roots, id)
    // Allocate sequential shortIds starting just past the current max for this prefix.
    let seq = Number(nextShortId(roots, prefix).split('-').pop()) - 1
    const now = new Date().toISOString()
    const clone = (src: Node, top: boolean): Node => ({
      ...src,
      id: nanoid(),
      shortId: `${prefix}-${++seq}`,
      title: top ? `${src.title} copy` : src.title,
      createdAt: now,
      updatedAt: now,
      activities: [],
      comments: [],
      children: src.children.map(c => clone(c, false)),
    })
    const copy = clone(node, true)
    if (parentId === null) copy.workspace = node.workspace ?? get().doc.activeWorkspace
    set(s => {
      let roots2 = addChild(s.doc.roots, parentId, copy)
      const siblings = parentId ? findNode(roots2, parentId)?.children ?? [] : roots2
      const origIdx = siblings.findIndex(c => c.id === id)
      const copyIdx = siblings.findIndex(c => c.id === copy.id)
      if (origIdx !== -1 && copyIdx !== -1 && copyIdx !== origIdx + 1) {
        roots2 = reorderChildren(roots2, parentId, copyIdx, origIdx + 1)
      }
      return { doc: { ...s.doc, roots: roots2 } }
    })
    if (parent) get().logActivity(parent.id, `Duplicated “${node.title}”`)
    schedulePersist(get)
    return copy.id
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
  // Re-read the document from disk without persisting — used by the reminder
  // widget window to pick up changes made in the main window.
  async reload() {
    try { set({ doc: await get().adapter.load() }) } catch { /* keep current */ }
  },
}))
