import { useEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Node } from '../types'
import { mergedStages, type StageMeta } from '../theme'
import { useStore } from '../store/useStore'
import { useVocab } from '../hooks/useVocab'
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
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(stage.label)
  const [menu, setMenu] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const v = useVocab()
  const allStages = mergedStages(useStore(s => s.doc.stages), useStore(s => s.doc.stageLabels), useStore(s => s.doc.stageOrder))
  const otherStages = allStages.filter(s => s.id !== stage.id)

  useEffect(() => { setLabel(stage.label) }, [stage.label])
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) { setMenu(false); setMoveOpen(false) } }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menu])

  const submit = () => {
    const t = val.trim()
    if (!t) return
    onAdd(t, parentId)
    setVal('')
  }

  const commitLabel = () => {
    setEditing(false)
    const t = label.trim()
    if (t && t !== stage.label) useStore.getState().renameStage(stage.id, t)
    else setLabel(stage.label)
  }

  const remove = () => {
    setMenu(false)
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
        {editing ? (
          <input
            className="colhead-edit"
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitLabel() }
              if (e.key === 'Escape') { setLabel(stage.label); setEditing(false) }
            }}
          />
        ) : (
          <button className="colhead-title" onDoubleClick={() => setEditing(true)} title="Double-click to rename">{stage.label}</button>
        )}
        <span className="cnt">{rows.length}</span>
        <div className="colmenu" ref={menuRef}>
          <button className="colmenu-btn" onClick={() => { setMenu(m => !m); setMoveOpen(false) }} aria-label={`${stage.label} stage actions`}><Icon name="ti-dots" /></button>
          {menu ? (
            <div className="nmenu-pop colmenu-pop" onClick={e => e.stopPropagation()}>
              {!moveOpen ? (
                <>
                  <button className="nmenu-item" onClick={() => { setMenu(false); setEditing(true) }}><Icon name="ti-pencil" /> Rename</button>
                  <button className="nmenu-item" onClick={() => setMoveOpen(true)}><Icon name="ti-arrows-move-horizontal" /> Move to…</button>
                  {custom ? (
                    <>
                      <div className="nmenu-sep" />
                      <button className="nmenu-item nmenu-danger" onClick={remove}><Icon name="ti-trash" /> Delete stage</button>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="nmenu-move">
                  <div className="nmenu-move-head">
                    <button className="nmenu-back" onClick={() => setMoveOpen(false)} aria-label="Back"><Icon name="ti-chevron-left" /></button>
                    Move before
                  </div>
                  <div className="nmenu-move-list">
                    {otherStages.map(s => (
                      <button key={s.id} className="nmenu-item nmenu-move-item" onClick={() => { useStore.getState().moveStageTo(stage.id, s.id); setMenu(false); setMoveOpen(false) }}>
                        <span className="nmenu-stage-dot" style={{ background: s.dot }} />
                        <span className="nmenu-move-lbl">{s.label}</span>
                      </button>
                    ))}
                    <button className="nmenu-item" onClick={() => { useStore.getState().moveStageTo(stage.id, null); setMenu(false); setMoveOpen(false) }}><Icon name="ti-arrow-bar-to-right" /> Move to end</button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
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
            <label className="col-add-pick">
              <span className="col-add-pick-lbl"><Icon name="ti-folder" /> Add to {v.module}</span>
              <select className="col-add-sel" value={parentId} onChange={e => setParentId(e.target.value)} aria-label={`Which ${v.module}`}>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </label>
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
