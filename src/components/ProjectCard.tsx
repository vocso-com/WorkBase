import type { Node } from '../types'
import { STATUS, COLORS } from '../theme'
import { progressOf } from '../lib/progress'
import { leaves } from '../lib/tree'
import { tagBg, tagFg } from '../lib/colorMode'
import { useDetail } from '../hooks/useDetail'
import { ProgressRing } from './ui/ProgressRing'
import { Tag } from './ui/Tag'
import { Icon } from './ui/Icon'

export function ProjectCard({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const color = node.color ?? 'gray'
  return (
    <div className="card" onClick={onOpen}>
      <div className="accent" style={{ background: COLORS[color] }} />
      <div className="pad">
        <div className="row1">
          <div className="ic" style={{ background: tagBg(color), color: tagFg(color) }}>
            <Icon name={node.icon ?? 'ti-folder'} />
          </div>
          <div className="dot" style={{ background: STATUS[node.status].dot }} />
        </div>
        <div
          className="title"
          onClick={e => { e.stopPropagation(); useDetail.getState().open(node.id) }}
        >
          {node.title}
        </div>
        {node.description ? <div className="sub">{node.description}</div> : null}
        {node.tags && node.tags.length > 0 ? (
          <div className="tags">
            {node.tags.map(t => (
              <Tag key={t.name} tag={t} />
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ padding: '6px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 500 }}>{node.shortId}</span>
        <ProgressRing value={progressOf(node)} color={COLORS[color]} size={42} />
      </div>
      <div className="foot">
        <Icon name="ti-stack-2" /> {node.children.length} modules · {leaves(node).length} tasks
      </div>
    </div>
  )
}
