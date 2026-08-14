import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Node } from '../types'
import type { StageMeta } from '../theme'
import { askConfirm } from '../hooks/useConfirm'
import { TaskCard } from './TaskCard'
import { Icon } from './ui/Icon'

export interface TaskRow {
  task: Node
  label: string
  color: string
}

interface ModuleOpt { id: string; title: string }

export function KanbanColumn({
  stage,
  custom,
  rows,
  modules,
  defaultParentId,
  onAdd,
  onRemove,
}: {
  stage: StageMeta
  custom: boolean
  rows: TaskRow[]
  modules: ModuleOpt[]
  defaultParentId: string
  onAdd: (title: string, parentId: string) => void
  onRemove: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const [adding, setAdding] = useState(false)
  const [val, setVal] = useState('')
  const [parentId, setParentId] = useState(defaultParentId)

  const submit = () => {
    const t = val.trim()
    if (!t) return
    onAdd(t, parentId)
    setVal('')
  }

  const remove = () => {
    askConfirm({
      title: 'Delete stage',
      message: `Delete the "${stage.label}" stage? Its cards move back to To do.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: onRemove,
    })
  }

  return (
    <div ref={setNodeRef} className={`col${isOver ? ' drag' : ''}`} style={{ '--col-accent': stage.dot } as React.CSSProperties}>
      <div className="colhead">
        <span className="sdot" style={{ background: stage.dot }} />
        {stage.label}
        <span className="cnt">{rows.length}</span>
        {custom ? (
          <button className="col-del" onClick={remove} aria-label={`Delete ${stage.label} stage`}><Icon name="ti-trash" /></button>
        ) : null}
      </div>
      {rows.length === 0 && !adding ? (
        <div className="col-empty">Drop tasks here</div>
      ) : (
        rows.map(r => <TaskCard key={r.task.id} node={r.task} color={r.color} label={r.label} />)
      )}
      {adding ? (
        <div className="col-add-box">
          <textarea
            autoFocus
            placeholder="Enter a title…"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
              if (e.key === 'Escape') { setAdding(false); setVal('') }
            }}
            rows={2}
          />
          {modules.length > 1 ? (
            <select className="col-add-sel" value={parentId} onChange={e => setParentId(e.target.value)} aria-label="Module">
              {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          ) : null}
          <div className="col-add-row">
            <button className="col-add-go" onClick={submit}>Add card</button>
            <button className="col-add-x" onClick={() => { setAdding(false); setVal('') }} aria-label="Cancel"><Icon name="ti-x" /></button>
          </div>
        </div>
      ) : (
        <button className="col-add" onClick={() => setAdding(true)}><Icon name="ti-plus" /> Add a card</button>
      )}
    </div>
  )
}
