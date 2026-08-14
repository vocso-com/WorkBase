import { useState } from 'react'
import type { Node } from '../types'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { hex } from '../theme'
import { progressOf } from '../lib/progress'
import { dueInfo } from '../lib/due'
import { tagBg, tagFg } from '../lib/colorMode'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { Icon } from './ui/Icon'
import { BoardItemRow } from './BoardItemRow'

function hasOverdueDescendant(n: Node): boolean {
  if (n.status !== 'done' && dueInfo(n.dueDate)?.tone === 'overdue') return true
  return n.children.some(hasOverdueDescendant)
}

// One consistent progress color, switched by health: complete → green,
// delayed (any overdue item) → red, otherwise on-track → blue.
function progressColor(node: Node, pc: number): string {
  if (pc >= 100) return hex('teal')
  if (hasOverdueDescendant(node)) return hex('red')
  return hex('blue')
}

function isChildDone(child: Node): boolean {
  return child.children.length > 0 ? progressOf(child) === 100 : child.status === 'done'
}

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
  const color = node.color ?? 'gray'
  const total = node.children.length
  const done = node.children.filter(isChildDone).length
  const pc = progressOf(node)
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
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{done}/{total}</span>
        </div>
        <div className="bar2">
          <span style={{ width: `${pc}%`, background: progressColor(node, pc) }} />
        </div>
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
