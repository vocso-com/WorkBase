import { useState } from 'react'
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import type { ColorKey, Node, Status } from '../types'
import { COLORS, hex, mergedStages } from '../theme'
import { useStore } from '../store/useStore'
import { findNode } from '../lib/tree'
import { askConfirm } from '../hooks/useConfirm'
import { KanbanColumn, type TaskRow } from './KanbanColumn'
import { Icon } from './ui/Icon'

const TRASH_ID = '__trash__'

function TrashZone() {
  const { setNodeRef, isOver } = useDroppable({ id: TRASH_ID })
  return (
    <div ref={setNodeRef} className={`kb-trash${isOver ? ' over' : ''}`} title="Drop to delete">
      <Icon name="ti-trash" />
    </div>
  )
}

const SWATCHES: ColorKey[] = ['blue', 'teal', 'coral', 'violet', 'amber', 'red', 'gray']

/** Collect every leaf task with its immediate parent as a colored label. */
function collectRows(root: Node): TaskRow[] {
  const rows: TaskRow[] = []
  const walk = (n: Node, parent: Node | null) => {
    if (n.children.length === 0) {
      if (parent) rows.push({ task: n, label: parent.title, color: (n.labelColor ?? n.color ?? parent.color ?? 'gray') as ColorKey })
    } else {
      for (const c of n.children) walk(c, n)
    }
  }
  walk(root, null)
  return rows
}

export function KanbanView({ node }: { node: Node }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const isProject = useStore(s => s.doc.roots.some(r => r.id === node.id))
  const customStages = useStore(s => s.doc.stages)
  const stageLabels = useStore(s => s.doc.stageLabels)
  const stageOrder = useStore(s => s.doc.stageOrder)
  const stages = mergedStages(customStages, stageLabels, stageOrder)
  const validIds = new Set(stages.map(s => s.id))
  const rows = collectRows(node)
  const accent = hex(node.color)

  const modules = isProject ? node.children.map(c => ({ id: c.id, title: c.title })) : []
  const defaultParentId = modules[0]?.id ?? node.id
  const [dragging, setDragging] = useState(false)

  function onDragEnd(e: DragEndEvent) {
    setDragging(false)
    const overId = e.over ? String(e.over.id) : null
    const id = String(e.active.id)
    if (overId === TRASH_ID) {
      const title = findNode(useStore.getState().doc.roots, id)?.title ?? 'this card'
      askConfirm({ title: 'Delete', message: `Delete "${title}"?`, danger: true, confirmLabel: 'Delete', onConfirm: () => useStore.getState().remove(id) })
      return
    }
    if (overId && validIds.has(overId)) useStore.getState().setStatus(id, overId as Status)
  }

  function addCard(title: string, status: Status, parentId: string) {
    const id = useStore.getState().addChildNode(parentId, title)
    useStore.getState().setStatus(id, status)
  }

  return (
    <DndContext sensors={sensors} onDragStart={() => setDragging(true)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(false)}>
      <div className="board" style={{ '--board-accent': accent } as React.CSSProperties}>
        <div className="kb" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(244px, 1fr)) minmax(210px, 0.7fr)` }}>
          {stages.map(stage => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              custom={!['todo', 'doing', 'done', 'blocked'].includes(stage.id)}
              rows={rows.filter(r => r.task.status === stage.id)}
              modules={modules}
              defaultParentId={defaultParentId}
              onAdd={(title, parentId) => addCard(title, stage.id, parentId)}
              onRemove={() => useStore.getState().removeStage(stage.id)}
            />
          ))}
          <AddStageColumn />
        </div>
      </div>
      {dragging ? <TrashZone /> : null}
    </DndContext>
  )
}

function AddStageColumn() {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [color, setColor] = useState<ColorKey>('violet')

  const submit = () => {
    if (!label.trim()) return
    useStore.getState().addStage(label, color)
    setLabel('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="stage-add" onClick={() => setOpen(true)}>
        <Icon name="ti-plus" /> Add stage
      </button>
    )
  }
  return (
    <div className="stage-add-box">
      <input
        autoFocus
        placeholder="Stage name…"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
      />
      <div className="stage-swatches">
        {SWATCHES.map(c => (
          <button
            key={c}
            className={`stage-sw${color === c ? ' on' : ''}`}
            style={{ background: COLORS[c] }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
      </div>
      <div className="stage-add-row">
        <button className="col-add-go" onClick={submit}>Add stage</button>
        <button className="col-add-x" onClick={() => setOpen(false)} aria-label="Cancel"><Icon name="ti-x" /></button>
      </div>
    </div>
  )
}
