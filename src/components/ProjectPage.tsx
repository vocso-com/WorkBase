import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { useView } from '../hooks/useView'
import { findNode } from '../lib/tree'
import { hex } from '../theme'
import { BoardView } from './BoardView'
import { KanbanView } from './KanbanView'
import { FlowView } from './FlowView'

export default function ProjectPage() {
  const roots = useStore(s => s.doc.roots)
  const path = useNav(s => s.path)
  const view = useView(s => s.view)

  const nodeId = path[path.length - 1]
  const node = nodeId ? findNode(roots, nodeId) : null
  if (!node) return null

  const root = path[0] ? findNode(roots, path[0]) : null
  const proj = hex(root?.color ?? 'gray')

  return (
    <div className="proj-page" style={{ '--proj': proj } as React.CSSProperties}>
      {view === 'board' ? <BoardView node={node} /> : view === 'kanban' ? <KanbanView node={node} /> : <FlowView node={node} />}
    </div>
  )
}
