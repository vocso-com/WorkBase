import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Node, Stage } from '../types'
import { hex, stageMeta, PRIORITY_META } from '../theme'
import { layoutTree, cardHasMeta, cardHasFooter, type FlowNode, type ExpandPredicate } from '../lib/layout'
import { progressOf, statusCounts } from '../lib/progress'
import { leaves, findNode, findParent } from '../lib/tree'
import { dependents } from '../lib/deps'
import { tagBg, tagFg } from '../lib/colorMode'
import { toText } from '../lib/text'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { useConfirm } from '../hooks/useConfirm'
import { useVocab } from '../hooks/useVocab'
import type { Vocab } from '../lib/vocab'
import { confirmDeleteNode } from '../lib/confirmDelete'
import { confirmToggleDone } from '../lib/confirmToggleDone'
import { ProgressBar } from './ui/ProgressBar'
import { Icon } from './ui/Icon'
import { ProgressRing } from './ui/ProgressRing'
import { Checkbox } from './ui/Checkbox'
import { DueChip } from './DueChip'

const MIN_K = 0.3
const MAX_K = 1.8
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// Root stays expanded unless explicitly collapsed; deeper nodes default to
// collapsed so expanding a node reveals its children one level at a time.
const expandPred: ExpandPredicate = (n, depth) => (depth === 0 ? n.collapsed !== true : n.collapsed === false)

interface Transform { x: number; y: number; k: number }
interface LiveDrag { id: string; x: number; y: number }

function descendantsOf(n: Node): Set<string> {
  const s = new Set<string>()
  const walk = (m: Node) => { s.add(m.id); m.children.forEach(walk) }
  walk(n)
  return s
}

export function FlowView({ node }: { node: Node }) {
  const stages = useStore(s => s.doc.stages)
  const stageLabels = useStore(s => s.doc.stageLabels)
  const vocab = useVocab()
  const [orient, setOrient] = useState<'h' | 'v'>(node.flowOrientation ?? 'h')
  const showDeps = node.flowDeps !== false
  const showDesc = node.flowDesc !== false
  // Restore the remembered orientation when switching to a different project.
  useEffect(() => { setOrient(node.flowOrientation ?? 'h') }, [node.id, node.flowOrientation])
  const layout = useMemo(() => layoutTree(node, expandPred, orient, { showDesc }), [node, orient, showDesc])
  const byId = useMemo(() => new Map(layout.nodes.map(n => [n.id, n])), [layout])
  const accent = hex(node.color)

  const vpRef = useRef<HTMLDivElement>(null)
  const [tf, setTf] = useState<Transform>({ x: 0, y: 0, k: 1 })
  const [live, setLive] = useState<LiveDrag | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [selId, setSel] = useState<string | null>(null)   // keyboard-focused node
  const [editId, setEditId] = useState<string | null>(null) // node being renamed inline
  const [spotlight, setSpotlight] = useState(false)        // dim all but the selected dependency chain

  // Spotlight: the selected node's full dependency chain — everything it
  // (transitively) depends on, plus everything that depends on it. Non-chain
  // cards dim so the path of what blocks what stands out. null when off.
  const spotSet = useMemo(() => {
    if (!spotlight || !selId || !findNode([node], selId)) return null
    const set = new Set<string>([selId])
    const up = [selId]
    while (up.length) { const n = findNode([node], up.pop() as string); for (const d of n?.dependsOn ?? []) if (!set.has(d)) { set.add(d); up.push(d) } }
    const down = [selId]
    while (down.length) { for (const dep of dependents([node], down.pop() as string)) if (!set.has(dep.id)) { set.add(dep.id); down.push(dep.id) } }
    return set
  }, [spotlight, selId, node])
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  // When the canvas last actually moved under a drag — used to tell a genuine
  // double-click apart from two pans in quick succession.
  const pannedAt = useRef(0)
  const nodeDrag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)

  const posOf = useCallback(
    (fn: FlowNode): { x: number; y: number } => {
      if (live && live.id === fn.id) return { x: live.x, y: live.y }
      return fn.node.pos ?? { x: fn.x, y: fn.y }
    },
    [live],
  )

  const fit = useCallback(() => {
    const vp = vpRef.current
    if (!vp) return
    const pad = 48
    const k = clamp(Math.min((vp.clientWidth - pad * 2) / layout.width, (vp.clientHeight - pad * 2) / layout.height), MIN_K, 1.4)
    setTf({ k, x: (vp.clientWidth - layout.width * k) / 2, y: (vp.clientHeight - layout.height * k) / 2 })
  }, [layout.width, layout.height])

  const fitRef = useRef(fit)
  fitRef.current = fit

  // Center a node and its visible sub-nodes in the viewport.
  const focusSubtree = useCallback((id: string) => {
    const vp = vpRef.current
    if (!vp) return
    const target = byId.get(id)
    if (!target) return
    const subtree = descendantsOf(target.node)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const fnode of layout.nodes) {
      if (!subtree.has(fnode.id)) continue
      const p = fnode.node.pos ?? { x: fnode.x, y: fnode.y }
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + fnode.w); maxY = Math.max(maxY, p.y + fnode.h)
    }
    if (!isFinite(minX)) return
    const bw = maxX - minX, bh = maxY - minY, pad = 64
    const k = clamp(Math.min((vp.clientWidth - pad * 2) / bw, (vp.clientHeight - pad * 2) / bh), MIN_K, MAX_K)
    setTf({ k, x: (vp.clientWidth - bw * k) / 2 - minX * k, y: (vp.clientHeight - bh * k) / 2 - minY * k })
  }, [byId, layout])
  const focusRef = useRef(focusSubtree)
  focusRef.current = focusSubtree

  // When set, re-frame after the next layout recompute (used by bulk actions so
  // the canvas is always well-framed; single node toggles keep the user's view).
  const refit = useRef(false)
  // When set, focus this node's subtree after the next layout recompute (used so
  // expanding-on-click reveals children before we frame them).
  const focusPending = useRef<string | null>(null)
  // A single click centers a node — but that must not fire on the first click of
  // a double-click, or the node slides out from under the cursor and the second
  // click misses (landing on empty canvas → the add-node flow). So defer the
  // centering; opening on double-click cancels it first.
  const centerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearCenter = useCallback(() => {
    if (centerTimer.current) { clearTimeout(centerTimer.current); centerTimer.current = null }
  }, [])
  useEffect(() => clearCenter, [clearCenter]) // clean up on unmount

  // Frame on switching to a different project/module.
  useLayoutEffect(() => { fitRef.current() }, [node.id])
  // Re-frame after collapse/expand-all, orientation change, or layout reset.
  useEffect(() => {
    if (refit.current) { refit.current = false; fitRef.current() }
    if (focusPending.current) { const id = focusPending.current; focusPending.current = null; focusRef.current(id) }
  }, [layout])

  useEffect(() => {
    const vp = vpRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setTf(t => {
        const k = clamp(t.k * (e.deltaY < 0 ? 1.12 : 0.89), MIN_K, MAX_K)
        const r = k / t.k
        return { k, x: mx - (mx - t.x) * r, y: my - (my - t.y) * r }
      })
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [])

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.fn')) return
    pan.current = { sx: e.clientX, sy: e.clientY, ox: tf.x, oy: tf.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const p = pan.current
    if (!p) return
    if (Math.abs(e.clientX - p.sx) + Math.abs(e.clientY - p.sy) > 3) pannedAt.current = Date.now()
    setTf(t => ({ ...t, x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) }))
  }
  // Capture has to be released explicitly: while it is held the viewport keeps
  // swallowing every pointer event and `pointerleave` never fires, so a missed
  // pointerup (window blur, context menu, dragging off-window) would leave the
  // canvas stuck panning.
  const releasePan = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    pan.current = null
  }

  // Double-click empty canvas → create a node where you clicked.
  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.fn')) return
    // Two clicks that close together are also what panning twice in a row looks
    // like. Creating a node then is never what was meant, so a recent drag
    // suppresses it.
    if (Date.now() - pannedAt.current < 400) return
    const vp = vpRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const cx = (e.clientX - rect.left - tf.x) / tf.k
    const cy = (e.clientY - rect.top - tf.y) / tf.k
    const id = useStore.getState().addChildNode(node.id, node.children.length ? 'New module' : 'New item')
    useStore.getState().setPos(id, { x: cx - 110, y: cy - 30 })
    useDetail.getState().open(id)
  }

  const onNodeDown = (e: React.PointerEvent, fn: FlowNode) => {
    e.stopPropagation()
    const p = posOf(fn)
    nodeDrag.current = { id: fn.id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onNodeMove = (e: React.PointerEvent) => {
    const d = nodeDrag.current
    if (!d) return
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true
    const nx = d.ox + (e.clientX - d.sx) / tf.k
    const ny = d.oy + (e.clientY - d.sy) / tf.k
    setLive({ id: d.id, x: nx, y: ny })
    // A drop target is any node (not self / not a descendant) whose box contains
    // the dragged node's centre — dropping there reparents.
    const dragged = byId.get(d.id)
    if (!dragged) return
    const cx = nx + dragged.w / 2
    const cy = ny + dragged.h / 2
    const subtree = descendantsOf(dragged.node)
    let target: string | null = null
    for (const other of layout.nodes) {
      if (other.id === d.id || subtree.has(other.id)) continue
      const p = other.node.pos ?? { x: other.x, y: other.y }
      if (cx >= p.x && cx <= p.x + other.w && cy >= p.y && cy <= p.y + other.h) { target = other.id; break }
    }
    setDropTarget(target)
  }
  const onNodeUp = (fn: FlowNode, e?: React.PointerEvent) => {
    if (e) {
      const el = e.currentTarget as HTMLElement
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }
    const d = nodeDrag.current
    nodeDrag.current = null
    const target = dropTarget
    setDropTarget(null)
    if (!d) { setLive(null); return }
    if (d.moved && live) {
      if (target) {
        useStore.getState().move(fn.id, target, 99999)
        useStore.getState().setPos(fn.id, undefined)
        useStore.getState().setCollapsed(target, false)
      } else {
        useStore.getState().setPos(fn.id, { x: live.x, y: live.y })
      }
    } else {
      // Select immediately (the keyboard focus ring), then center this node and
      // its sub-nodes. Centering is deferred, so a double-click (which opens the
      // node) can cancel it before it moves — see centerTimer / clearCenter.
      setSel(fn.id)
      clearCenter()
      centerTimer.current = setTimeout(() => {
        centerTimer.current = null
        if (fn.hasChildren && !fn.expanded) {
          useStore.getState().setCollapsed(fn.id, false)
          focusPending.current = fn.id
        }
        focusRef.current(fn.id)
      }, 240)
    }
    setLive(null)
  }

  const toggle = (fn: FlowNode) => useStore.getState().setCollapsed(fn.id, fn.expanded)
  const addChild = (fn: FlowNode) => {
    useStore.getState().setCollapsed(fn.id, false)
    const id = useStore.getState().addChildNode(fn.id, fn.depth === 0 ? 'New module' : 'New item')
    useDetail.getState().open(id)
  }
  const del = (fn: FlowNode) => {
    confirmDeleteNode(fn.node, () => {
      if (useDetail.getState().openId === fn.id) useDetail.getState().close()
    })
  }

  // ── Selection, keyboard navigation & inline editing ───────────────────────
  // Pan (keeping zoom) so a node sits in the middle of the viewport.
  const centerNode = useCallback((id: string) => {
    const fnode = byId.get(id); const vp = vpRef.current
    if (!fnode || !vp) return
    const p = fnode.node.pos ?? { x: fnode.x, y: fnode.y }
    setTf(t => ({ k: t.k, x: vp.clientWidth / 2 - (p.x + fnode.w / 2) * t.k, y: vp.clientHeight / 2 - (p.y + fnode.h / 2) * t.k }))
  }, [byId])
  const selectAndCenter = useCallback((id: string) => { setSel(id); centerNode(id) }, [centerNode])

  // A node created or revealed by the keyboard is selected (and optionally
  // opened for renaming) once the layout that includes it has been computed.
  const pending = useRef<{ id: string; edit: boolean } | null>(null)
  useEffect(() => {
    const p = pending.current
    if (p && byId.has(p.id)) { pending.current = null; selectAndCenter(p.id); if (p.edit) setEditId(p.id) }
  }, [byId, selectAndCenter])

  // Latest state for the single window key listener.
  const kb = useRef({ selId, orient, node, byId, editId })
  kb.current = { selId, orient, node, byId, editId }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { selId, orient, node, byId, editId } = kb.current
      if (editId) return // the inline editor owns its keys
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (useConfirm.getState().current || useDetail.getState().openId) return // don't fight a dialog/modal

      const store = useStore.getState()
      const cur = selId && byId.has(selId) ? selId : null
      const curNode = cur ? findNode([node], cur) : null
      const isExpanded = (n: Node) => n.children.length > 0 && byId.has(n.children[0].id)
      const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

      if (arrows.includes(e.key)) {
        e.preventDefault()
        if (!curNode) { selectAndCenter(node.id); return }
        const parent = findParent([node], cur!)
        const sibs = parent ? parent.children : [node]
        const idx = sibs.findIndex(s => s.id === cur)
        const child = e.key === (orient === 'h' ? 'ArrowRight' : 'ArrowDown')
        const parentDir = e.key === (orient === 'h' ? 'ArrowLeft' : 'ArrowUp')
        const next = e.key === (orient === 'h' ? 'ArrowDown' : 'ArrowRight')
        if (child) {
          if (curNode.children.length === 0) return
          if (!isExpanded(curNode)) { store.setCollapsed(cur!, false); pending.current = { id: curNode.children[0].id, edit: false } }
          else selectAndCenter(curNode.children[0].id)
        } else if (parentDir) {
          if (isExpanded(curNode)) store.setCollapsed(cur!, true)
          else if (parent) selectAndCenter(parent.id)
        } else {
          const nx = sibs[idx + (next ? 1 : -1)]
          if (nx) selectAndCenter(nx.id)
        }
        return
      }

      if (e.key === ' ') { e.preventDefault(); if (curNode) confirmToggleDone(curNode); return }
      if (e.key === 'F2') { e.preventDefault(); if (cur) setEditId(cur); return }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (curNode) confirmDeleteNode(curNode, () => { setSel(null); if (useDetail.getState().openId === cur) useDetail.getState().close() })
        return
      }
      if (e.key === 'Escape') { setSel(null); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (!curNode) { if (node.children[0]) selectAndCenter(node.children[0].id); return }
        // Enter → sibling (child of the same parent); Tab → child of the node.
        const parent = e.key === 'Enter' ? (findParent([node], cur!) ?? node) : curNode
        const name = parent.id === node.id ? 'New module' : 'New item'
        store.setCollapsed(parent.id, false)
        const id = store.addChildNode(parent.id, name)
        pending.current = { id, edit: true }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectAndCenter])

  const resetLayout = () => { refit.current = true; useStore.getState().clearPositions(node.id) }
  const toggleOrient = () => {
    const next = orient === 'h' ? 'v' : 'h'
    refit.current = true
    setOrient(next)
    useStore.getState().patch(node.id, { flowOrientation: next })
  }
  const collapseAll = () => { refit.current = true; useStore.getState().setCollapsedAll(node.id, true) }
  const expandAll = () => { refit.current = true; useStore.getState().setCollapsedAll(node.id, false) }

  return (
    <div className="flow-wrap" style={{ '--board-accent': accent } as React.CSSProperties}>
      <div
        ref={vpRef}
        className="flow-vp"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={releasePan}
        onPointerCancel={releasePan}
        onLostPointerCapture={() => { pan.current = null }}
        onDoubleClick={onDoubleClick}
      >
        <div className="fcanvas" style={{ transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.k})`, width: layout.width, height: layout.height }}>
          <svg className="fedges" width={layout.width} height={layout.height}>
            <defs>
              <marker id="fdep-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 z" fill="var(--amber)" />
              </marker>
            </defs>
            {/* Dependency edges sit under the hierarchy so the tree stays the
                dominant read. They can point any direction, so they route
                between the facing sides of the two boxes. */}
            {showDeps ? layout.edges.filter(e => e.kind === 'dep').map(e => {
              const a = byId.get(e.from)
              const b = byId.get(e.to)
              if (!a || !b) return null
              return (
                <path
                  key={e.id}
                  className="fedge-dep"
                  d={depPath(posOf(a), a, posOf(b), b)}
                  markerEnd="url(#fdep-arrow)"
                />
              )
            }) : null}
            {layout.edges.filter(e => e.kind === 'child').map(e => {
              const a = byId.get(e.from)
              const b = byId.get(e.to)
              if (!a || !b) return null
              const pa = posOf(a)
              const pb = posOf(b)
              let d: string
              if (orient === 'h') {
                const x1 = pa.x + a.w, y1 = pa.y + a.h / 2, x2 = pb.x, y2 = pb.y + b.h / 2
                const mx = (x1 + x2) / 2
                d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
              } else {
                const x1 = pa.x + a.w / 2, y1 = pa.y + a.h, x2 = pb.x + b.w / 2, y2 = pb.y
                const my = (y1 + y2) / 2
                d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`
              }
              return <path key={e.id} d={d} stroke={e.color} strokeWidth={3} fill="none" opacity={0.8} strokeLinecap="round" />
            })}
          </svg>
          {layout.nodes.map(fn => (
            <FlowNodeCard
              key={fn.id}
              fn={fn}
              stages={stages}
              stageLabels={stageLabels}
              kicker={kickerFor(fn, byId, vocab)}
              showDesc={showDesc}
              pos={posOf(fn)}
              dragging={live?.id === fn.id}
              isDropTarget={dropTarget === fn.id}
              onPointerDown={e => onNodeDown(e, fn)}
              onPointerMove={onNodeMove}
              onPointerUp={e => onNodeUp(fn, e)}
              onPointerCancel={e => onNodeUp(fn, e)}
              onOpen={() => { clearCenter(); useDetail.getState().open(fn.id) }}
              onToggle={() => toggle(fn)}
              onAdd={() => addChild(fn)}
              onDelete={() => del(fn)}
              selected={selId === fn.id}
              dimmed={!!spotSet && !spotSet.has(fn.id)}
              editing={editId === fn.id}
              onCommitTitle={title => { const t = title.trim(); if (t) useStore.getState().patch(fn.id, { title: t }); setEditId(null) }}
              onCancelEdit={() => setEditId(null)}
            />
          ))}
        </div>
      </div>

      <div className="flow-ctl">
        <button
          onClick={toggleOrient}
          aria-label="Toggle orientation"
          title={orient === 'h' ? 'Switch to vertical' : 'Switch to horizontal'}
        >
          <Icon name={orient === 'h' ? 'ti-layout-distribute-vertical' : 'ti-layout-distribute-horizontal'} />
        </button>
        <button
          className={showDesc ? 'on' : undefined}
          onClick={() => { refit.current = true; useStore.getState().patch(node.id, { flowDesc: !showDesc }) }}
          aria-label="Toggle descriptions"
          aria-pressed={showDesc}
          title={showDesc ? 'Hide descriptions' : 'Show descriptions'}
        >
          <Icon name="ti-align-left" />
        </button>
        <button
          className={showDeps ? 'on' : undefined}
          onClick={() => useStore.getState().patch(node.id, { flowDeps: !showDeps })}
          aria-label="Toggle dependency links"
          aria-pressed={showDeps}
          title={showDeps ? 'Hide dependency links' : 'Show dependency links'}
        >
          <Icon name="ti-arrows-split-2" />
        </button>
        <button
          className={spotlight ? 'on' : undefined}
          onClick={() => setSpotlight(s => !s)}
          aria-label="Spotlight dependency chain"
          aria-pressed={spotlight}
          title="Spotlight the selected item's dependency chain (dim the rest)"
        >
          <Icon name="ti-bulb" />
        </button>
        <span className="flow-sep" />
        <button onClick={collapseAll} aria-label="Collapse all" title="Collapse all"><Icon name="ti-fold" /></button>
        <button onClick={expandAll} aria-label="Expand all" title="Expand all"><Icon name="ti-list-tree" /></button>
        <span className="flow-sep" />
        <button onClick={resetLayout} aria-label="Reset layout" title="Reset layout"><Icon name="ti-refresh" /></button>
        <span className="flow-sep" />
        <button onClick={() => setTf(t => zoomAt(t, vpRef.current, -1))} aria-label="Zoom out"><Icon name="ti-minus" /></button>
        <span className="flow-pct">{Math.round(tf.k * 100)}%</span>
        <button onClick={() => setTf(t => zoomAt(t, vpRef.current, 1))} aria-label="Zoom in"><Icon name="ti-plus" /></button>
        <span className="flow-sep" />
        <button onClick={fit} aria-label="Fit to screen"><Icon name="ti-maximize" /></button>
      </div>
      <div className="flow-hint"><Icon name="ti-keyboard" /> Arrows move · Tab/Enter add · Space done · F2 rename · double-click opens</div>
    </div>
  )
}

type Box = { w: number; h: number }
type Pt = { x: number; y: number }

/**
 * A cubic between the facing sides of two boxes. Unlike child edges — which
 * always run along the layout's depth axis — a dependency can point in any
 * direction, so the exit side is chosen from whichever axis separates the two
 * boxes more.
 */
function depPath(pa: Pt, a: Box, pb: Pt, b: Box): string {
  const ca = { x: pa.x + a.w / 2, y: pa.y + a.h / 2 }
  const cb = { x: pb.x + b.w / 2, y: pb.y + b.h / 2 }
  const dx = cb.x - ca.x
  const dy = cb.y - ca.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    const x1 = dx >= 0 ? pa.x + a.w : pa.x
    const x2 = dx >= 0 ? pb.x : pb.x + b.w
    const mx = (x1 + x2) / 2
    return `M${x1},${ca.y} C${mx},${ca.y} ${mx},${cb.y} ${x2},${cb.y}`
  }
  const y1 = dy >= 0 ? pa.y + a.h : pa.y
  const y2 = dy >= 0 ? pb.y : pb.y + b.h
  const my = (y1 + y2) / 2
  return `M${ca.x},${y1} C${ca.x},${my} ${cb.x},${my} ${cb.x},${y2}`
}

function zoomAt(t: Transform, vp: HTMLDivElement | null, dir: number): Transform {
  const cx = vp ? vp.clientWidth / 2 : 0
  const cy = vp ? vp.clientHeight / 2 : 0
  const k = clamp(t.k * (dir > 0 ? 1.2 : 0.83), MIN_K, MAX_K)
  const r = k / t.k
  return { k, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r }
}

interface CardProps {
  fn: FlowNode
  stages: Stage[]
  stageLabels?: Record<string, string>
  kicker: string
  showDesc: boolean
  pos: { x: number; y: number }
  dragging: boolean
  isDropTarget: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: (e: React.PointerEvent) => void
  onOpen: () => void
  onToggle: () => void
  onAdd: () => void
  onDelete: () => void
  selected: boolean
  dimmed: boolean
  editing: boolean
  onCommitTitle: (title: string) => void
  onCancelEdit: () => void
}

function FlowNodeCard({ fn, stages, stageLabels, kicker, showDesc, pos, dragging, isDropTarget, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onOpen, onToggle, onAdd, onDelete, selected, dimmed, editing, onCommitTitle, onCancelEdit }: CardProps) {
  const { node, depth } = fn
  const drop = isDropTarget ? ' fn-droptarget' : ''
  // Named distinctly: the container branch below has its own `done` count, and
  // shadowing it here silently interpolates a number into the class name.
  const doneCls = node.status === 'done' ? ' fn-done' : ''
  const sm = stageMeta(stages, node.status, stageLabels)
  // Which card renders is decided by kind, not depth — depth is unbounded, so a
  // task that grew sub-tasks becomes a container like any other. Color follows
  // the same rule: tasks take the status color, containers keep their identity
  // color, `labelColor` overrides either.
  const isContainerCard = depth > 0 && node.children.length > 0
  const isContainer = depth === 0 || isContainerCard
  const color: string = node.labelColor ?? (isContainer ? (node.color ?? 'gray') : sm.color)
  const style: React.CSSProperties = { left: pos.x, top: pos.y, width: fn.w, height: fn.h, zIndex: dragging ? 20 : undefined }
  const stop = (e: React.PointerEvent) => e.stopPropagation()
  const prio = node.priority ? PRIORITY_META[node.priority] : null
  const desc = toText(node.description)

  const actions = (
    <div className="fn-act">
      <button onPointerDown={stop} onClick={onOpen} aria-label="Open details" title="Open details"><Icon name="ti-arrows-diagonal" /></button>
      <button onPointerDown={stop} onClick={onAdd} aria-label="Add child" title="Add sub-item"><Icon name="ti-plus" /></button>
      {depth > 0 ? <button className="fn-del" onPointerDown={stop} onClick={onDelete} aria-label="Delete" title="Delete"><Icon name="ti-trash" /></button> : null}
    </div>
  )

  // Header: status as a dot and priority as a flag, so neither costs a whole
  // row the way a pair of pills did. The kicker says what the card is, the
  // shortId identifies it.
  // The completion control sits against the card's own title, never in the
  // header — the header's kicker names the *containing* card, so a tick there
  // reads as completing the parent.
  // Completing something whose sub-items are still open is usually a mistake,
  // but sometimes it is exactly right — so this warns and then gets out of the
  // way rather than refusing.
  const tick = (
    <span className="fn-tick" onPointerDown={stop} title={node.status === 'done' ? 'Mark not done' : 'Mark done'}>
      <Checkbox status={node.status} onToggle={() => confirmToggleDone(node)} />
    </span>
  )

  const head = (
    <div className="fn-head">
      <span className="fn-kicker">{kicker}</span>
      {prio ? (
        <span className="fn-flag" style={{ color: hex(prio.color) }} title={`${prio.label} priority`}>
          <Icon name="ti-flag-filled" />
        </span>
      ) : null}
      <span className="fn-sid">{node.shortId}</span>
    </div>
  )

  // Descriptions are stored as rich-text HTML; the card shows the flattened
  // text, one line when collapsed and up to four when this card is expanded.
  const description = desc && showDesc ? (
    <div className={`fn-desc${node.cardOpen ? ' fn-desc-open' : ''}`}>{desc}</div>
  ) : null

  // Compact indicators for what a card carries but has no room to show, plus
  // the per-card expand control. Rendered in the footer of both card kinds, and
  // hidden wholesale by the canvas-wide content switch.
  const meta = !cardHasMeta(node, showDesc) ? null : (
    <span className="fn-meta">
      {node.attachments?.length ? (
        <span className="fn-chip" title={`${node.attachments.length} attachment${node.attachments.length === 1 ? '' : 's'}`}>
          <Icon name="ti-paperclip" />{node.attachments.length}
        </span>
      ) : null}
      {node.dependsOn?.length ? (
        <span className="fn-chip" title={`Blocked by ${node.dependsOn.length}`}>
          <Icon name="ti-arrows-split-2" />{node.dependsOn.length}
        </span>
      ) : null}
      {node.comments?.length ? (
        <span className="fn-chip" title={`${node.comments.length} comment${node.comments.length === 1 ? '' : 's'}`}>
          <Icon name="ti-message-circle" />{node.comments.length}
        </span>
      ) : null}
      {desc ? (
        <button
          className="fn-more"
          onPointerDown={stop}
          onClick={() => useStore.getState().patch(node.id, { cardOpen: !node.cardOpen })}
          aria-expanded={!!node.cardOpen}
          title={node.cardOpen ? 'Show less' : 'Show more'}
        >
          {node.cardOpen ? 'Less' : 'More'}<Icon name={node.cardOpen ? 'ti-chevron-up' : 'ti-chevron-down'} />
        </button>
      ) : null}
    </span>
  )

  const toggle = fn.hasChildren ? (
    <button
      className={`fn-toggle${fn.expanded ? ' open' : ''}`}
      onPointerDown={stop}
      onClick={onToggle}
      aria-label={fn.expanded ? 'Collapse' : 'Expand'}
      title={fn.expanded ? 'Collapse' : `Expand (${node.children.length})`}
    >
      {fn.expanded ? <Icon name="ti-minus" /> : <span className="fn-toggle-n">{node.children.length}</span>}
    </button>
  ) : null

  const handlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick: (e: React.MouseEvent) => { e.stopPropagation(); onOpen() } }

  // Every card is outlined in its own color — status for tasks, identity for
  // modules and the root — so the canvas reads as a set of tagged objects.
  const outline: React.CSSProperties = { borderColor: hex(color) }
  const sel = (selected ? ' is-sel' : '') + (dimmed ? ' is-dim' : '')

  // The title, swapped for an inline editor when this node is being renamed
  // (F2, or right after a keyboard add). Commits on Enter/blur, reverts on Esc.
  const titleContent = editing ? (
    <input
      className="fn-title-edit"
      defaultValue={node.title}
      autoFocus
      onFocus={e => e.currentTarget.select()}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') onCommitTitle(e.currentTarget.value)
        else if (e.key === 'Escape') onCancelEdit()
      }}
      onBlur={e => onCommitTitle(e.currentTarget.value)}
    />
  ) : node.title

  if (depth === 0) {
    return (
      <div className={`fn fn-root${dragging ? ' fn-drag' : ''}${drop}${sel}`} style={{ ...style, ...outline }} {...handlers}>
        <div className="fn-band" style={{ background: `linear-gradient(135deg, ${hex(color)}, ${hex(color)}bb)` }}>
          {node.image ? (
            <div className="fn-band-ic fn-band-ic-img" style={{ backgroundImage: `url(${node.image})` }} />
          ) : (
            <div className="fn-band-ic"><Icon name={node.icon ?? 'ti-folder'} /></div>
          )}
        </div>
        <div className="fn-root-body">
          {head}
          <div className="fn-title">{titleContent}</div>
          <div className="fn-sub">{node.children.length} modules · {leaves(node).length} tasks</div>
        </div>
        <ProgressRing value={progressOf(node)} color={hex(color)} size={54} />
        {actions}
        {toggle}
      </div>
    )
  }

  if (isContainerCard) {
    const total = leaves(node).filter(l => l.id !== node.id).length
    const done = statusCounts(node).done
    const kids = node.children.length
    return (
      <div className={`fn fn-mod${dragging ? ' fn-drag' : ''}${drop}${doneCls}${sel}`} style={{ ...style, ...outline }} {...handlers}>
        {head}
        <div className="fn-mod-title">
          {/* Hovering swaps the identity tile for the tick — same slot, so the
              title never shifts. */}
          <span className="fn-mark fn-mark-lg">
            <span className="fn-mod-ic" style={{ background: tagBg(color), color: tagFg(color) }}><Icon name={node.icon ?? 'ti-folder'} /></span>
            {tick}
          </span>
          <span className="fn-title">{titleContent}</span>
        </div>
        {description}
        <div className="fn-mod-rollup">
          <span className="fn-count" title={`${kids} direct sub-item${kids === 1 ? '' : 's'}`}>
            <Icon name="ti-subtask" />{kids} · {done}/{total}
          </span>
          <DueChip dueDate={earliestDue(node)} />
          {meta}
        </div>
        <ProgressBar node={node} className="fn-bar" />
        {actions}
        {toggle}
      </div>
    )
  }

  const tags = node.tags ?? []
  return (
    <div className={`fn fn-task${dragging ? ' fn-drag' : ''}${drop}${doneCls}${sel}`} style={{ ...style, ...outline }} {...handlers}>
      {head}
      <div className="fn-titlerow">
        <span className="fn-mark">
          <span className="fn-status" style={{ background: sm.dot }} title={sm.label} />
          {tick}
        </span>
        <div className="fn-title fn-task-title">{titleContent}</div>
      </div>
      {description}
      {/* Rendered only when measured: an empty footer div still occupies its
          CSS height and would spill out of the card. */}
      {cardHasFooter(node, showDesc) ? (
        <div className="fn-task-foot">
          <DueChip dueDate={node.dueDate} />
          {meta}
        </div>
      ) : null}
      {tags.length > 0 ? (
        <div className="fn-task-tags">
          {tags.slice(0, 2).map(t => <span key={t.name} className="fn-tag" style={{ background: tagBg(t.color), color: tagFg(t.color) }}>{t.name}</span>)}
        </div>
      ) : null}
      {actions}
      {toggle}
    </div>
  )
}

/**
 * The uppercase label in a card's header row: what this card *is*. Nesting is
 * unbounded, so the most useful label is the name of whatever contains it; only
 * cards hanging directly off the project fall back to naming their own kind.
 */
function kickerFor(fn: FlowNode, byId: Map<string, FlowNode>, vocab: Vocab): string {
  if (fn.depth === 0) return vocab.project
  const parent = fn.parentId ? byId.get(fn.parentId) : undefined
  if (parent && parent.depth > 0) return parent.node.title
  return fn.node.children.length > 0 ? vocab.module : vocab.task
}

/**
 * The soonest due date on a node or anywhere under it, for the module rollup.
 * The node's own date counts: a module card has no other place to show it.
 */
function earliestDue(n: Node): string | undefined {
  let best: string | undefined
  const walk = (m: Node) => {
    if (m.dueDate && (!best || m.dueDate < best)) best = m.dueDate
    m.children.forEach(walk)
  }
  walk(n)
  return best
}
