import type { Node } from '../../types'
import { COLORS, mergedStages } from '../../theme'
import { leaves } from '../../lib/tree'
import { useStore } from '../../store/useStore'

// The single progress-bar implementation, segmented by stage color. Used across
// project cards, the header, flow nodes, module cards, and the checklist so the
// coloring logic is identical everywhere.
export function ProgressBar({ node, className }: { node: Node; className: string }) {
  const stages = mergedStages(useStore(s => s.doc.stages))
  const ls = leaves(node)
  const total = ls.length
  const counts: Record<string, number> = {}
  for (const l of ls) counts[l.status] = (counts[l.status] ?? 0) + 1
  const segments = stages.filter(s => (counts[s.id] ?? 0) > 0)
  return (
    <div className={className}>
      {total === 0
        ? <span style={{ width: '100%', background: 'var(--chip)' }} />
        : segments.map(s => <span key={s.id} style={{ width: `${(counts[s.id] / total) * 100}%`, background: COLORS[s.color] }} />)}
    </div>
  )
}
