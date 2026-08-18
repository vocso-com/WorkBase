import { useState } from 'react'
import type { Node } from '../types'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { hex } from '../theme'
import { isComplete } from '../lib/deps'
import { tagBg, tagFg } from '../lib/colorMode'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { Icon } from './ui/Icon'
import { Checkbox } from './ui/Checkbox'
import { ProgressBar } from './ui/ProgressBar'
import { DepBadges } from './DepBadges'
import { BoardItemRow } from './BoardItemRow'
import { NodeMenu } from './NodeMenu'

function AddItemRow({ node }: { node: Node }) {
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')
  const submit = () => {
    const t = val.trim()
    if (!t) return
    useStore.getState().addChildNode(node.id, t)
    setVal('')
  }
  if (!adding) {
    return (
      <div className="check" style={{ color: 'var(--faint)', marginTop: 4 }} onClick={e => { e.stopPropagation(); setAdding(true) }}>
        <Icon name="ti-plus" className="box" />
        <span>New item</span>
      </div>
    )
  }
  return (
    <div className="mc-add" onClick={e => e.stopPropagation()}>
      <input
        autoFocus
        placeholder="Item name…"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setAdding(false); setVal('') } }}
        onBlur={() => { if (!val.trim()) setAdding(false) }}
      />
    </div>
  )
}

export function ModuleCard({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const roots = useStore(s => s.doc.roots)
  const color = node.color ?? 'gray'
  const total = node.children.length
  const done = node.children.filter(isComplete).length
  const canDrillIn = node.children.length > 0

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id, data: { type: 'module' } })
  const nest = useDroppable({ id: `nest:${node.id}`, data: { type: 'nest', moduleId: node.id } })

  const style: React.CSSProperties = {
    cursor: canDrillIn ? 'pointer' : 'default',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 40 : undefined,
  }

  return (
    <div ref={setNodeRef} className="card mcard" onClick={canDrillIn ? onOpen : undefined} style={style}>
      <div className="accent" style={{ background: hex(color) }} />
      <div className="pad">
        <div ref={nest.setNodeRef} className={`row1 mc-head${nest.isOver ? ' mc-nesting' : ''}`} {...attributes} {...listeners}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span className="mc-check" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
              <Checkbox status={node.status} onToggle={() => useStore.getState().toggleDone(node.id)} />
            </span>
            <div className="ic" style={{ width: 32, height: 32, fontSize: 17, background: tagBg(color), color: tagFg(color) }}>
              <Icon name={node.icon ?? 'ti-folder'} />
            </div>
            <div
              data-testid="module-card-title"
              style={{ fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); useDetail.getState().open(node.id) }}
            >
              {node.title}
            </div>
          </div>
          <div className="mc-head-right">
            <DepBadges node={node} roots={roots} compact />
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{done}/{total}</span>
            <NodeMenu id={node.id} className="mcard-menu" />
          </div>
        </div>
        <ProgressBar node={node} className="bar2" />
        <SortableContext items={node.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {node.children.map(child => (
            <BoardItemRow key={child.id} child={child} color={color} parentId={node.id} />
          ))}
        </SortableContext>
        <AddItemRow node={node} />
      </div>
    </div>
  )
}
