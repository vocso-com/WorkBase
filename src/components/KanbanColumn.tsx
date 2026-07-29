import { useDroppable } from '@dnd-kit/core'
import type { Node, Status } from '../types'
import { STATUS } from '../theme'
import { TaskCard } from './TaskCard'

export function KanbanColumn({ status, tasks }: { status: Status; tasks: Node[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const meta = STATUS[status]

  return (
    <div ref={setNodeRef} className={`col${isOver ? ' drag' : ''}`}>
      <div className="colhead">
        <span className="sdot" style={{ background: meta.dot }} />
        {meta.label}
        <span className="cnt">{tasks.length}</span>
      </div>
      {tasks.map(t => (
        <TaskCard key={t.id} node={t} color={t.color ?? 'gray'} />
      ))}
    </div>
  )
}
