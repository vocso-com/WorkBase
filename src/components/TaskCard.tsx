import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Node } from '../types'
import { PRIORITY_META, hex } from '../theme'
import { tagBg, tagFg } from '../lib/colorMode'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { Tag } from './ui/Tag'
import { Icon } from './ui/Icon'
import { DueChip } from './DueChip'

export function TaskCard({ node, color, label }: { node: Node; color: string; label?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: node.id })
  const tags = node.tags ?? []
  const done = node.status === 'done'
  const initial = node.title.trim().charAt(0).toUpperCase() || '?'
  const base = CSS.Translate.toString(transform)

  const style: React.CSSProperties = {
    transform: isDragging ? `${base ?? ''} rotate(3deg) scale(1.03)` : base,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      className={`tcard${isDragging ? ' dragging' : ''}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <button
        className={`tcheck${done ? ' done' : ''}`}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); useStore.getState().toggleDone(node.id) }}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        title={done ? 'Mark not done' : 'Mark done'}
      >
        <Icon name={done ? 'ti-square-check' : 'ti-square'} />
      </button>
      {label ? (
        <span className="tlabel" style={{ background: tagBg(color), color: tagFg(color) }}>
          {label}
        </span>
      ) : null}
      <div className="tt" onClick={e => { e.stopPropagation(); useDetail.getState().open(node.id) }}>
        {node.title}
      </div>
      <div className="meta">
        <span className="tid">{node.shortId}</span>
        <DueChip dueDate={node.dueDate} />
        {node.priority ? (
          <span className="tprio" style={{ background: tagBg(PRIORITY_META[node.priority].color), color: tagFg(PRIORITY_META[node.priority].color) }}>
            {PRIORITY_META[node.priority].label}
          </span>
        ) : null}
        {tags.map(t => (
          <Tag key={t.name} tag={t} />
        ))}
        <span className="who" style={{ background: hex(color) }}>
          {initial}
        </span>
      </div>
    </div>
  )
}
