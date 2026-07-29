import type { Node } from '../types'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { ModuleCard } from './ModuleCard'
import { Icon } from './ui/Icon'

function addModule(node: Node) {
  const name = window.prompt('Module name')
  if (!name || !name.trim()) return
  useStore.getState().addChildNode(node.id, name.trim())
}

export function BoardView({ node }: { node: Node }) {
  return (
    <div className="grid">
      {node.children.map(child => (
        <ModuleCard key={child.id} node={child} onOpen={() => useNav.getState().open(child.id)} />
      ))}
      <div className="card newcard" onClick={() => addModule(node)}>
        <Icon name="ti-plus" style={{ fontSize: 24 }} />
        New module
      </div>
    </div>
  )
}
