import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Node } from '../types'
import { PRIORITY_META, hex } from '../theme'
import { tagBg, tagFg } from '../lib/colorMode'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { toText } from '../lib/text'
import { Tag } from './ui/Tag'
import { Icon } from './ui/Icon'
import { Checkbox } from './ui/Checkbox'
import { DueChip } from './DueChip'
import { NodeMenu } from './NodeMenu'

export function TaskCard({ node, color }: { node: Node; color: string; label?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: node.id })
  const tags = node.tags ?? []
  const attachCount = node.attachments?.length ?? 0
  const hasDesc = !!toText(node.description).trim()
  const done = node.status === 'done'
  const initial = node.title.trim().charAt(0).toUpperCase() || '?'
  const base = CSS.Translate.toString(transform)
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

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
      <NodeMenu id={node.id} className="tcard-menu" />
      <div className="tt-row">
        <span className={`tcheck${done ? ' done' : ''}`} onPointerDown={stop} onClick={stop}>
          <Checkbox status={node.status} onToggle={() => useStore.getState().toggleDone(node.id)} />
        </span>
        <div className="tt" onClick={e => { e.stopPropagation(); useDetail.getState().open(node.id) }}>
          {node.title}
        </div>
      </div>
      <div className="meta">
        {node.priority ? (
          <span className="tprio" style={{ background: tagBg(PRIORITY_META[node.priority].color), color: tagFg(PRIORITY_META[node.priority].color) }}>
            {PRIORITY_META[node.priority].label}
          </span>
        ) : null}
        {tags.map(t => (
          <Tag key={t.name} tag={t} />
        ))}
        <DueChip dueDate={node.dueDate} />
        {hasDesc ? <span className="tmini" title="Has description"><Icon name="ti-align-left" /></span> : null}
        {attachCount > 0 ? <span className="tmini" title={`${attachCount} attachment${attachCount > 1 ? 's' : ''}`}><Icon name="ti-paperclip" /> {attachCount}</span> : null}
        <span className="tid">{node.shortId}</span>
        <span className="who" style={{ background: hex(color) }}>
          {initial}
        </span>
      </div>
    </div>
  )
}
