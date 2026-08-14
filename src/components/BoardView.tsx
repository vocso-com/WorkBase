import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Node } from '../types'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { ModuleCard } from './ModuleCard'
import { SortableCard } from './SortableCard'
import { Icon } from './ui/Icon'

function AddModuleCard({ node }: { node: Node }) {
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
        New module
      </div>
    )
  }
  return (
    <div className="newcard-box">
      <input
        autoFocus
        placeholder="Module name…"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setVal('') } }}
      />
      <div className="newcard-row">
        <button className="col-add-go" onClick={submit}>Add module</button>
        <button className="col-add-x" onClick={() => { setAdding(false); setVal('') }} aria-label="Cancel"><Icon name="ti-x" /></button>
      </div>
    </div>
  )
}

export function BoardView({ node }: { node: Node }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const childIds = node.children.map(c => c.id)

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = node.children.findIndex(c => c.id === active.id)
    const to = node.children.findIndex(c => c.id === over.id)
    if (from === -1 || to === -1) return
    useStore.getState().reorder(node.id, from, to)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext items={childIds} strategy={rectSortingStrategy}>
        <div className="grid">
          {node.children.map(child => (
            <SortableCard key={child.id} id={child.id}>
              <ModuleCard node={child} onOpen={() => useNav.getState().open(child.id)} />
            </SortableCard>
          ))}
          <AddModuleCard node={node} />
        </div>
      </SortableContext>
    </DndContext>
  )
}
