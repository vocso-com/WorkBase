import type { MouseEvent } from 'react'
import type { Node } from '../types'
import { COLORS, hex, mergedStages, stageMeta } from '../theme'
import { progressOf } from '../lib/progress'
import { leaves } from '../lib/tree'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { useVocab } from '../hooks/useVocab'
import { toText } from '../lib/text'
import { Tag } from './ui/Tag'
import { Icon } from './ui/Icon'

export function ProjectCard({ node, onOpen }: { node: Node; onOpen: (e: MouseEvent) => void }) {
  const color = node.color ?? 'gray'
  const v = useVocab()
  const stages = useStore(s => s.doc.stages)
  const sm = stageMeta(stages, node.status)
  const pct = progressOf(node)

  // Progress bar segmented by stage color (matches the header roll-up).
  const allStages = mergedStages(stages)
  const ls = leaves(node)
  const total = ls.length
  const counts: Record<string, number> = {}
  for (const l of ls) counts[l.status] = (counts[l.status] ?? 0) + 1
  const segments = allStages.filter(s => (counts[s.id] ?? 0) > 0)

  return (
    <div className="card pcard" onClick={onOpen}>
      <div
        className={`pcover${node.image ? ' pcover-img' : ''}`}
        style={node.image ? { backgroundImage: `url(${node.image})` } : { background: `linear-gradient(135deg, ${hex(color)}, ${hex(color)}bb)` }}
      >
        {!node.image ? (
          <div className="pcover-ic"><Icon name={node.icon ?? 'ti-folder'} /></div>
        ) : null}
        <span className="pcover-status"><span className="sdot" style={{ background: sm.dot }} /> {sm.label}</span>
      </div>
      <div className="pad">
        <div className="title" onClick={e => { e.stopPropagation(); useDetail.getState().open(node.id) }}>
          {node.title}
        </div>
        {toText(node.description) ? <div className="sub">{toText(node.description)}</div> : null}
        {node.tags && node.tags.length > 0 ? (
          <div className="tags">
            {node.tags.map(t => <Tag key={t.name} tag={t} />)}
          </div>
        ) : null}
      </div>
      <div className="pcard-prog">
        {total === 0
          ? <span style={{ width: '100%', background: 'var(--chip)' }} />
          : segments.map(s => <span key={s.id} style={{ width: `${(counts[s.id] / total) * 100}%`, background: COLORS[s.color] }} />)}
      </div>
      <div className="foot">
        <Icon name="ti-stack-2" /> {node.children.length} {node.children.length === 1 ? v.module : v.modules} · {leaves(node).length} {leaves(node).length === 1 ? v.task : v.tasks}
        <span style={{ flex: 1 }} />
        <span className="pcard-id">{node.shortId}</span>
        <span className="pcard-pct" style={{ color: hex(color) }}>{pct}%</span>
      </div>
    </div>
  )
}
