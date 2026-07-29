import type { Node } from '../types'
import { COLORS } from '../theme'
import { progressOf } from '../lib/progress'
import { tagBg, tagFg } from '../lib/colorMode'
import { useStore } from '../store/useStore'
import { Icon } from './ui/Icon'
import { Checkbox } from './ui/Checkbox'
import { Tag } from './ui/Tag'

function isChildDone(child: Node): boolean {
  if (child.children.length > 0) return progressOf(child) === 100
  return child.status === 'done'
}

function addItem(node: Node, e: React.MouseEvent) {
  e.stopPropagation()
  const name = window.prompt('Item name')
  if (!name || !name.trim()) return
  useStore.getState().addChildNode(node.id, name.trim())
}

export function ModuleCard({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const color = node.color ?? 'gray'
  const total = node.children.length
  const done = node.children.filter(isChildDone).length
  const pc = progressOf(node)

  return (
    <div className="card mcard" onClick={onOpen}>
      <div className="accent" style={{ background: COLORS[color] }} />
      <div className="pad">
        <div className="row1">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="ic" style={{ width: 32, height: 32, fontSize: 17, background: tagBg(color), color: tagFg(color) }}>
              <Icon name={node.icon ?? 'ti-folder'} />
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{node.title}</div>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>{done}/{total}</span>
        </div>
        <div className="bar2">
          <span style={{ width: `${pc}%`, background: COLORS[color] }} />
        </div>
        {node.children.map(child => (
          <div key={child.id} className={`check ${child.status === 'done' ? 'done' : ''}`} onClick={e => e.stopPropagation()}>
            <Checkbox status={child.status} color={color} onToggle={() => useStore.getState().toggleDone(child.id)} />
            <span className="grow">{child.title}</span>
            {(child.tags ?? []).map(t => (
              <Tag key={t.name} tag={t} />
            ))}
            {child.status === 'blocked' ? (
              <span className="mini" style={{ background: tagBg('red'), color: tagFg('red') }}>Blocked</span>
            ) : null}
          </div>
        ))}
        <div className="check" style={{ color: 'var(--faint)', marginTop: 4 }} onClick={e => addItem(node, e)}>
          <Icon name="ti-plus" className="box" />
          <span>New item</span>
        </div>
      </div>
    </div>
  )
}
