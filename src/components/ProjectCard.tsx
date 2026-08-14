import type { Node } from '../types'
import { hex, stageMeta } from '../theme'
import { progressOf } from '../lib/progress'
import { leaves } from '../lib/tree'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { toText } from '../lib/text'
import { Tag } from './ui/Tag'
import { Icon } from './ui/Icon'

export function ProjectCard({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const color = node.color ?? 'gray'
  const stages = useStore(s => s.doc.stages)
  const sm = stageMeta(stages, node.status)
  const pct = progressOf(node)

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
      <div className="pcard-prog"><span style={{ width: `${pct}%`, background: hex(color) }} /></div>
      <div className="foot">
        <Icon name="ti-stack-2" /> {node.children.length} modules · {leaves(node).length} tasks
        <span style={{ flex: 1 }} />
        <span className="pcard-id">{node.shortId}</span>
        <span className="pcard-pct" style={{ color: hex(color) }}>{pct}%</span>
      </div>
    </div>
  )
}
