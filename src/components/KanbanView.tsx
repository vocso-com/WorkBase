import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import type { Node, Status } from '../types'
import { STATUS_ORDER } from '../theme'
import { leaves } from '../lib/tree'
import { useStore } from '../store/useStore'
import { KanbanColumn } from './KanbanColumn'

export function KanbanView({ node }: { node: Node }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const tasks = node.children.length === 0 ? [] : leaves(node).filter(t => t.id !== node.id)

  function onDragEnd(e: DragEndEvent) {
    if (e.over && STATUS_ORDER.includes(e.over.id as Status)) {
      useStore.getState().setStatus(String(e.active.id), e.over.id as Status)
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="kb">
        {STATUS_ORDER.map(s => (
          <KanbanColumn key={s} status={s} tasks={tasks.filter(t => t.status === s)} />
        ))}
      </div>
    </DndContext>
  )
}
