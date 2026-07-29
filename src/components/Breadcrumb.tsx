import type { Node } from '../types'
import { findNode } from '../lib/tree'
import { Icon } from './ui/Icon'

export function Breadcrumb({
  roots,
  path,
  onHome,
  onGoto,
}: {
  roots: Node[]
  path: string[]
  onHome: () => void
  onGoto: (index: number) => void
}) {
  const crumbs = path.map(id => findNode(roots, id)).filter((n): n is Node => n !== null)

  return (
    <div className="crumb">
      <span className="link" onClick={onHome}>
        <Icon name="ti-home" /> Projects
      </span>
      {crumbs.map((node, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={node.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Icon name="ti-chevron-right" />
            {isLast ? (
              <b>{node.title}</b>
            ) : (
              <span className="link" onClick={() => onGoto(i)}>{node.title}</span>
            )}
          </span>
        )
      })}
    </div>
  )
}
