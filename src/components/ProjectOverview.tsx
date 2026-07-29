import type { ColorKey, Node } from '../types'
import { COLORS } from '../theme'
import { progressOf, statusCounts } from '../lib/progress'
import { leaves } from '../lib/tree'
import { ProgressRing } from './ui/ProgressRing'
import { Tag } from './ui/Tag'

export function ProjectOverview({ node }: { node: Node }) {
  const color = node.color ?? 'gray'
  const counts = statusCounts(node)
  const total = leaves(node).length
  const stats: [string, number][] = [
    ['Modules', node.children.length],
    ['Done', counts.done],
    ['In progress', counts.doing],
    ['Blocked', counts.blocked],
  ]
  const seg = (n: number, colorKey: ColorKey) =>
    n > 0 && total > 0 ? <span key={colorKey} style={{ width: `${(n / total) * 100}%`, background: COLORS[colorKey] }} /> : null

  return (
    <div className="over">
      <div className="left">
        <ProgressRing value={progressOf(node)} color={COLORS[color]} size={72} />
        <div>
          <div className="name">{node.title}</div>
          {node.description ? <div className="desc">{node.description}</div> : null}
          {node.tags && node.tags.length > 0 ? (
            <div className="tags" style={{ marginTop: 9 }}>
              {node.tags.map(t => (
                <Tag key={t.name} tag={t} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ flex: 2, minWidth: 300 }}>
        <div className="stats">
          {stats.map(([label, n]) => (
            <div className="stat" key={label}>
              <div className="n">{n}</div>
              <div className="l">{label}</div>
            </div>
          ))}
        </div>
        <div className="sbar">
          {seg(counts.done, 'teal')}
          {seg(counts.doing, 'amber')}
          {seg(counts.blocked, 'red')}
          {seg(counts.todo, 'gray')}
        </div>
      </div>
    </div>
  )
}
