import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { findNode } from '../lib/tree'
import { progressOf } from '../lib/progress'
import { COLORS } from '../theme'
import { ProjectOverview } from './ProjectOverview'
import { ViewToggle, type ViewKind } from './ViewToggle'
import { BoardView } from './BoardView'
import { ProgressRing } from './ui/ProgressRing'

export default function ProjectPage() {
  const roots = useStore(s => s.doc.roots)
  const path = useNav(s => s.path)
  const [view, setView] = useState<ViewKind>('board')

  const nodeId = path[path.length - 1]
  const node = nodeId ? findNode(roots, nodeId) : null
  if (!node) return null

  return (
    <div>
      {path.length === 1 ? (
        <ProjectOverview node={node} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '8px 0 16px' }}>
          <ProgressRing value={progressOf(node)} color={COLORS[node.color ?? 'gray']} size={44} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>{node.title}</div>
            {node.description ? <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{node.description}</div> : null}
          </div>
        </div>
      )}
      <ViewToggle view={view} onChange={setView} />
      {view === 'board' ? (
        <BoardView node={node} />
      ) : (
        <div data-testid="kanban-placeholder" style={{ color: 'var(--muted)', padding: '20px 0' }}>
          Kanban view
        </div>
      )}
    </div>
  )
}
