import type { MouseEvent } from 'react'
import type { Node } from '../types'
import { COLORS, hex, mergedStages, stageMeta } from '../theme'
import { progressOf, statusCounts, statusShares } from '../lib/progress'
import { baselineShare, scopeGrowth } from '../lib/scope'
import { leaves } from '../lib/tree'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { useVocab } from '../hooks/useVocab'
import { toText } from '../lib/text'
import { Tag } from './ui/Tag'
import { Icon } from './ui/Icon'
import { HealthBadge } from './ui/HealthBadge'

export function ProjectCard({ node, onOpen }: { node: Node; onOpen: (e: MouseEvent) => void }) {
  const color = node.color ?? 'gray'
  const v = useVocab()
  const stages = useStore(s => s.doc.stages)
  const stageLabels = useStore(s => s.doc.stageLabels)
  const sm = stageMeta(stages, node.status, stageLabels)
  const pct = progressOf(node, { isProject: true })

  // Progress bar segmented by stage color (matches the header roll-up).
  const allStages = mergedStages(stages, stageLabels, useStore(s => s.doc.stageOrder))
  // Weighted, like the number beside it — a bar counting leaves flat would
  // disagree with the percentage it sits next to.
  const total = leaves(node).length
  const shares = statusShares(node, { isProject: true })
  const segments = allStages.filter(s => (shares[s.id] ?? 0) > 0)

  // The track lengthens; the fill never shrinks. Decomposing a task adds
  // leaves, and showing that as lost progress would teach people to stop
  // planning in the tool — so the growth is marked and attributed instead.
  const mark = baselineShare(node)
  const growth = scopeGrowth(node)
  const doneCount = statusCounts(node).done

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
        <HealthBadge node={node} />
        {node.tags && node.tags.length > 0 ? (
          <div className="tags">
            {node.tags.map(t => <Tag key={t.name} tag={t} />)}
          </div>
        ) : null}
      </div>
      <div className="pcard-prog">
        {total === 0
          ? <span style={{ width: '100%', background: 'var(--chip)' }} />
          : segments.map(s => <span key={s.id} style={{ width: `${shares[s.id] * 100}%`, background: COLORS[s.color] }} />)}
        {mark !== null && mark < 1 ? (
          <i
            className="pcard-baseline"
            style={{ left: `${mark * 100}%` }}
            title={`Scope grew ${Math.round((growth ?? 0) * 100)}% since kickoff — everything right of this line was added`}
          />
        ) : null}
      </div>
      <div className="foot">
        <Icon name="ti-stack-2" /> {node.children.length} {node.children.length === 1 ? v.module : v.modules} · {leaves(node).length} {leaves(node).length === 1 ? v.task : v.tasks}
        <span style={{ flex: 1 }} />
        <span className="pcard-done">{doneCount} done</span>
        <span className="pcard-id">{node.shortId}</span>
        <span className="pcard-pct" style={{ color: hex(color) }}>{pct}%</span>
      </div>
    </div>
  )
}
