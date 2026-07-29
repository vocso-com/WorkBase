import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Node } from '../types'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { ModuleCard } from './ModuleCard'
import { SortableCard } from './SortableCard'
import { Icon } from './ui/Icon'

function addModule(node: Node) {
  const name = window.prompt('Module name')
  if (!name || !name.trim()) return
  useStore.getState().addChildNode(node.id, name.trim())
}

export function BoardView({ node }: { node: Node }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const childIds = node.children.map(c => c.id)

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = node.children.findIndex(c => c.id === active.id)
    const to = node.children.findIndex(c => c.id === over.id)
    if (from === -1 || to === -1) return
    useStore.getState().reorder(node.id, from, to)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext items={childIds} strategy={rectSortingStrategy}>
        <div className="grid">
          {node.children.map(child => (
            <SortableCard key={child.id} id={child.id}>
              <ModuleCard node={child} onOpen={() => useNav.getState().open(child.id)} />
            </SortableCard>
          ))}
          <div className="card newcard" onClick={() => addModule(node)}>
            <Icon name="ti-plus" style={{ fontSize: 24 }} />
            New module
          </div>
        </div>
      </SortableContext>
    </DndContext>
  )
}
