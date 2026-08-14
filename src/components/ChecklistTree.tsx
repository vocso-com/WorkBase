import { useState } from 'react'
import type { Node } from '../types'
import { PRIORITY_META } from '../theme'
import { tagBg, tagFg } from '../lib/colorMode'
import { leaves } from '../lib/tree'
import { statusCounts } from '../lib/progress'
import { dueInfo } from '../lib/due'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { Checkbox } from './ui/Checkbox'
import { Tag } from './ui/Tag'
import { Icon } from './ui/Icon'

interface Row { node: Node; depth: number }

// Depth-first flatten, descending only into expanded parents.
function flatten(items: Node[], depth: number, expanded: Set<string>, acc: Row[]) {
  for (const c of items) {
    acc.push({ node: c, depth })
    if (c.children.length > 0 && expanded.has(c.id)) flatten(c.children, depth + 1, expanded, acc)
  }
}

function subtreeIds(n: Node, acc = new Set<string>()): Set<string> {
  acc.add(n.id)
  n.children.forEach(c => subtreeIds(c, acc))
  return acc
}

// The checklist as an in-place tree: parents expand to reveal children, and any
// row can be dragged onto another to nest under it, or onto the root strip to
// promote it to a top-level item of this card.
export function ChecklistTree({ root, color }: { root: Node; color: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overRoot, setOverRoot] = useState(false)

  const rows: Row[] = []
  flatten(root.children, 0, expanded, rows)

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Move `dragId` under `parentId` (null → root). Guards against dropping a node
  // into itself or one of its own descendants.
  const drop = (parentId: string | null) => {
    const id = dragId
    setDragId(null); setOverId(null); setOverRoot(false)
    if (!id) return
    const dragged = root.children.length ? subtreeOwner(root, id) : null
    if (!dragged) return
    const targetId = parentId ?? root.id
    if (subtreeIds(dragged).has(targetId)) return // can't nest into self/descendant
    const parent = parentId ? findIn(root, parentId) : root
    const index = parent ? parent.children.length : 0
    useStore.getState().move(id, targetId === root.id ? root.id : targetId, index)
    if (parentId) setExpanded(prev => new Set(prev).add(parentId))
  }

  if (root.children.length === 0) return null

  return (
    <div className="cm-tree">
      {rows.map(({ node: c, depth }) => {
        const cc = c.labelColor ?? c.color ?? color
        const isParent = c.children.length > 0
        const overdue = c.status !== 'done' && dueInfo(c.dueDate)?.tone === 'overdue'
        const total = isParent ? leaves(c).filter(l => l.id !== c.id).length : 0
        const done = isParent ? statusCounts(c).done : 0
        const state = c.status === 'done' ? ' done' : overdue ? ' overdue' : ''
        return (
          <div
            key={c.id}
            className={`cm-trow${state}${dragId === c.id ? ' dragging' : ''}${overId === c.id ? ' drop-into' : ''}`}
            draggable
            onDragStart={e => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move' }}
            onDragEnd={() => { setDragId(null); setOverId(null); setOverRoot(false) }}
            onDragOver={e => { if (dragId && dragId !== c.id) { e.preventDefault(); setOverId(c.id); setOverRoot(false) } }}
            onDragLeave={() => setOverId(o => (o === c.id ? null : o))}
            onDrop={e => { e.preventDefault(); e.stopPropagation(); drop(c.id) }}
          >
            {Array.from({ length: depth }).map((_, i) => <span key={i} className="cm-tree-rail" />)}
            {isParent ? (
              <button className="cm-tree-caret" onClick={() => toggleExpand(c.id)} aria-label={expanded.has(c.id) ? 'Collapse' : 'Expand'}>
                <Icon name={expanded.has(c.id) ? 'ti-chevron-down' : 'ti-chevron-right'} />
              </button>
            ) : (
              <Checkbox status={c.status} color={cc} onToggle={() => useStore.getState().toggleDone(c.id)} />
            )}
            <span className="cm-trow-title" onClick={() => useDetail.getState().open(c.id)} title="Open details">{c.title}</span>
            {c.priority ? (
              <span className="tprio" style={{ background: tagBg(PRIORITY_META[c.priority].color), color: tagFg(PRIORITY_META[c.priority].color) }}>{PRIORITY_META[c.priority].label}</span>
            ) : null}
            {overdue ? <span className="cm-trow-overdue"><Icon name="ti-clock" /> Overdue</span> : null}
            {isParent ? <span className="check-sub-count">{done}/{total}</span> : (c.tags ?? []).map(t => <Tag key={t.name} tag={t} />)}
            <span className="cm-trow-grip" title="Drag to nest or promote"><Icon name="ti-grip-vertical" /></span>
            <button className="cm-check-del" onClick={() => useStore.getState().remove(c.id)} aria-label="Delete item"><Icon name="ti-trash" /></button>
          </div>
        )
      })}
      {dragId ? (
        <div
          className={`cm-tree-root-drop${overRoot ? ' over' : ''}`}
          onDragOver={e => { e.preventDefault(); setOverRoot(true); setOverId(null) }}
          onDragLeave={() => setOverRoot(false)}
          onDrop={e => { e.preventDefault(); drop(null) }}
        >
          <Icon name="ti-arrow-bar-to-left" /> Drop here to make it a top-level item
        </div>
      ) : null}
    </div>
  )
}

// Find a node within a subtree (root inclusive of its descendants).
function findIn(root: Node, id: string): Node | null {
  if (root.id === id) return root
  for (const c of root.children) {
    const f = findIn(c, id)
    if (f) return f
  }
  return null
}
function subtreeOwner(root: Node, id: string): Node | null {
  return findIn(root, id)
}
