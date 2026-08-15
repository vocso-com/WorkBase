import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Node } from '../types'
import { leaves, pathTo } from '../lib/tree'
import { statusCounts } from '../lib/progress'
import { dueInfo } from '../lib/due'
import { isBlocked } from '../lib/deps'
import { tagBg, tagFg } from '../lib/colorMode'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { useDetail } from '../hooks/useDetail'
import { Icon } from './ui/Icon'
import { Checkbox } from './ui/Checkbox'
import { Tag } from './ui/Tag'
import { DueChip } from './DueChip'

// A single board checklist row (leaf task or a sub-module) that can be dragged
// to reorder within its card, moved to another card, or dropped onto a card
// header to nest. The drag grip is a dedicated handle so row clicks still work.
export function BoardItemRow({ child, color, parentId }: { child: Node; color: string; parentId: string }) {
  const roots = useStore(s => s.doc.roots)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: child.id,
    data: { type: 'item', parentId },
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 30 : undefined,
  }
  const grip = (
    <button className="board-grip" {...attributes} {...listeners} onClick={e => e.stopPropagation()} aria-label="Drag to reorder">
      <Icon name="ti-grip-vertical" />
    </button>
  )

  if (child.children.length > 0) {
    const subs = leaves(child).filter(l => l.id !== child.id)
    const subDone = statusCounts(child).done
    return (
      <div
        ref={setNodeRef}
        style={style}
        data-testid={`child-row-${child.id}`}
        className="check check-item check-parent"
        onClick={e => { e.stopPropagation(); useDetail.getState().open(child.id) }}
        title="Open details"
      >
        {grip}
        <span className="check-sub-ic"><Icon name="ti-list-tree" /></span>
        <span className="check-parent-title">{child.title}</span>
        <div className="check-parent-meta">
          <DueChip dueDate={child.dueDate} />
          {(child.tags ?? []).slice(0, 1).map(t => <Tag key={t.name} tag={t} />)}
          <span className="check-sub-count">{subDone}/{subs.length}</span>
          <button
            className="check-drill-btn"
            onClick={e => { e.stopPropagation(); useNav.getState().set(pathTo(useStore.getState().doc.roots, child.id)) }}
            aria-label="Open sub-items"
            title="Open sub-items"
          ><Icon name="ti-chevron-right" /></button>
        </div>
      </div>
    )
  }

  const overdue = child.status !== 'done' && dueInfo(child.dueDate)?.tone === 'overdue'
  const blocked = child.dependsOn?.length ? isBlocked(roots, child) : false
  const state = child.status === 'done' ? 'done' : overdue ? 'overdue' : ''
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`child-row-${child.id}`}
      className={`check check-item ${state}`}
      onClick={e => e.stopPropagation()}
    >
      {grip}
      <Checkbox status={child.status} color={color} onToggle={() => useStore.getState().toggleDone(child.id)} />
      <span className="grow" style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); useDetail.getState().open(child.id) }}>
        {child.title}
      </span>
      <DueChip dueDate={child.dueDate} />
      {(child.tags ?? []).map(t => <Tag key={t.name} tag={t} />)}
      {blocked ? <span className="row-blocked" title="Blocked by an unfinished dependency"><Icon name="ti-lock" /> Blocked</span> : null}
      {child.status === 'blocked' ? (
        <span className="mini" style={{ background: tagBg('red'), color: tagFg('red') }}>Blocked</span>
      ) : null}
    </div>
  )
}
