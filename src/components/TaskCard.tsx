import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ColorKey, Node } from '../types'
import { COLORS } from '../theme'
import { useDetail } from '../hooks/useDetail'
import { Tag } from './ui/Tag'

export function TaskCard({ node, color }: { node: Node; color: ColorKey }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: node.id })
  const tags = node.tags ?? []
  const initial = node.title.trim().charAt(0).toUpperCase() || '?'

  const style: React.CSSProperties = {
    borderLeftColor: COLORS[color],
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} className="tcard" style={style} {...listeners} {...attributes}>
      <div className="tt" onClick={e => { e.stopPropagation(); useDetail.getState().open(node.id) }}>
        {node.title}
      </div>
      <div className="meta">
        {tags.map(t => (
          <Tag key={t.name} tag={t} />
        ))}
        <span className="who" style={{ background: COLORS[color] }}>
          {initial}
        </span>
      </div>
    </div>
  )
}
