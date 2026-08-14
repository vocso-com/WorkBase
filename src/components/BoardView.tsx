import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, pointerWithin, closestCenter, type DragEndEvent, type CollisionDetection } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Node } from '../types'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { findNode } from '../lib/tree'
import { cap } from '../lib/vocab'
import { useVocab } from '../hooks/useVocab'
import { ModuleCard } from './ModuleCard'
import { Icon } from './ui/Icon'

// Prefer a card's nest zone (its header) when the pointer is over it, so
// dropping onto a card nests; otherwise fall back to sortable reordering.
const collisionDetection: CollisionDetection = args => {
  const within = pointerWithin(args)
  const nest = within.find(c => String(c.id).startsWith('nest:') && String(c.id) !== `nest:${args.active.id}`)
  if (nest) return [nest]
  return closestCenter(args)
}

function AddModuleCard({ node }: { node: Node }) {
  const v = useVocab()
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')
  const submit = () => {
    const t = val.trim()
    if (!t) return
    const id = useStore.getState().addChildNode(node.id, t)
    setVal('')
    setAdding(false)
    useNav.getState().open(id)
  }
  if (!adding) {
    return (
      <div className="card newcard" onClick={() => setAdding(true)}>
        <Icon name="ti-plus" style={{ fontSize: 24 }} />
        New {v.module}
      </div>
    )
  }
  return (
    <div className="newcard-box">
      <input
        autoFocus
        placeholder={`${cap(v.module)} name…`}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setVal('') } }}
      />
      <div className="newcard-row">
        <button className="col-add-go" onClick={submit}>Add {v.module}</button>
        <button className="col-add-x" onClick={() => { setAdding(false); setVal('') }} aria-label="Cancel"><Icon name="ti-x" /></button>
      </div>
    </div>
  )
}

export function BoardView({ node }: { node: Node }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const childIds = node.children.map(c => c.id)

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const store = useStore.getState()
    const roots = store.doc.roots
    const a = active.data.current as { type?: string; parentId?: string } | undefined
    const o = over.data.current as { type?: string; parentId?: string; moduleId?: string } | undefined
    const activeId = String(active.id)
    const overId = String(over.id)

    // Drop onto a card's nest zone → make the dragged node a sub-item of it.
    if (o?.type === 'nest' && o.moduleId) {
      const target = o.moduleId
      if (target === activeId) return
      const activeNode = findNode(roots, activeId)
      if (activeNode && findNode(activeNode.children, target)) return // no nesting into own subtree
      store.move(activeId, target, 99999)
      store.setCollapsed(target, false)
      return
    }
    if (activeId === overId) return

    // Reorder module cards among siblings.
    if (a?.type === 'module' && o?.type === 'module') {
      const from = node.children.findIndex(c => c.id === activeId)
      const to = node.children.findIndex(c => c.id === overId)
      if (from !== -1 && to !== -1) store.reorder(node.id, from, to)
      return
    }

    // Reorder tasks within a card, or move a task into another card.
    if (a?.type === 'item' && o?.type === 'item' && a.parentId && o.parentId) {
      const toNode = findNode(roots, o.parentId)
      const to = toNode ? toNode.children.findIndex(c => c.id === overId) : -1
      if (to === -1) return
      if (a.parentId === o.parentId) {
        const fromNode = findNode(roots, a.parentId)
        const from = fromNode ? fromNode.children.findIndex(c => c.id === activeId) : -1
        if (from !== -1) store.reorder(a.parentId, from, to)
      } else {
        store.move(activeId, o.parentId, to)
      }
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragEnd={onDragEnd}>
      <SortableContext items={childIds} strategy={rectSortingStrategy}>
        <div className="grid">
          {node.children.map(child => (
            <ModuleCard key={child.id} node={child} onOpen={() => useNav.getState().open(child.id)} />
          ))}
          <AddModuleCard node={node} />
        </div>
      </SortableContext>
    </DndContext>
  )
}
