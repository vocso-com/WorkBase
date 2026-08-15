import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Node } from '../types'
import { useStore } from '../store/useStore'
import { useDetail } from '../hooks/useDetail'
import { useNav } from '../hooks/useNav'
import { askConfirm } from '../hooks/useConfirm'
import { findNode, findParent, pathTo } from '../lib/tree'
import { tagBg, tagFg } from '../lib/colorMode'
import { Icon } from './ui/Icon'

/**
 * Hover-revealed ⋯ menu for any node (project / module / task). Actions:
 * open details, drill in, duplicate, move to…, delete. Portaled to <body> and
 * fixed-positioned so it is never clipped by a scrolling column.
 */
export function NodeMenu({ id, className }: { id: string; className?: string }) {
  const roots = useStore(s => s.doc.roots)
  const [open, setOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [q, setQ] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)

  const node = findNode(roots, id)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const up = r.bottom + 300 > window.innerHeight
    const left = Math.min(r.right - 8, window.innerWidth - 224)
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, left), up })
  }, [open, moveOpen])

  if (!node) return null
  const parent = findParent(roots, id)
  const isProject = roots.some(r => r.id === id)
  const isContainer = node.children.length > 0
  const kind = isProject ? 'project' : isContainer ? 'module' : 'task'

  // Reparent targets: every node except this one, its descendants, and its
  // current parent (a no-op).
  const blocked = new Set<string>()
  const markSub = (n: Node) => { blocked.add(n.id); n.children.forEach(markSub) }
  markSub(node)
  const targets: { id: string; label: string; node: Node }[] = []
  const walk = (n: Node, trail: string[]) => {
    if (!blocked.has(n.id) && n.id !== parent?.id) targets.push({ id: n.id, label: [...trail, n.title].join(' › '), node: n })
    n.children.forEach(c => walk(c, [...trail, n.title]))
  }
  roots.forEach(r => walk(r, []))

  const close = () => { setOpen(false); setMoveOpen(false); setQ('') }
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }

  const openDetails = () => { useDetail.getState().open(id); close() }
  const drillIn = () => { useNav.getState().set(pathTo(roots, id)); close() }
  const duplicate = () => { useStore.getState().duplicate(id); close() }
  const moveTo = (value: string | null) => { useStore.getState().move(id, value, 99999); close() }
  const del = () => {
    close()
    askConfirm({
      title: 'Delete', danger: true, confirmLabel: 'Delete',
      message: `Delete "${node.title}"${isContainer ? ' and all its sub-items' : ''}? This can't be undone.`,
      onConfirm: () => {
        useStore.getState().remove(id)
        if (useNav.getState().path.includes(id)) useNav.getState().home()
      },
    })
  }

  return (
    <div className={`nmenu-wrap${className ? ` ${className}` : ''}`} onPointerDown={stop}>
      <button
        ref={btnRef}
        className="nmenu-btn"
        onClick={e => { stop(e); setOpen(o => !o) }}
        aria-label="Card actions"
        title="Actions"
      >
        <Icon name="ti-dots" />
      </button>
      {open && pos
        ? createPortal(
            <>
              <div className="nmenu-backdrop" onClick={e => { stop(e); close() }} onPointerDown={stop} />
              <div
                ref={popRef}
                className="nmenu-pop"
                style={{ position: 'fixed', left: pos.left, [pos.up ? 'bottom' : 'top']: pos.up ? window.innerHeight - pos.top : pos.top }}
                onClick={stop}
                onPointerDown={stop}
              >
                {!moveOpen ? (
                  <>
                    <button className="nmenu-item" onClick={openDetails}><Icon name="ti-eye" /> Open details</button>
                    {isContainer || isProject ? <button className="nmenu-item" onClick={drillIn}><Icon name="ti-arrow-bar-to-down" /> Open board</button> : null}
                    <button className="nmenu-item" onClick={duplicate}><Icon name="ti-copy" /> Duplicate</button>
                    <button className="nmenu-item" onClick={() => setMoveOpen(true)}><Icon name="ti-arrow-right" /> Move to…</button>
                    <div className="nmenu-sep" />
                    <button className="nmenu-item nmenu-danger" onClick={del}><Icon name="ti-trash" /> Delete {kind}</button>
                  </>
                ) : (
                  <div className="nmenu-move">
                    <div className="nmenu-move-head">
                      <button className="nmenu-back" onClick={() => setMoveOpen(false)} aria-label="Back"><Icon name="ti-chevron-left" /></button>
                      Move to
                    </div>
                    <input className="nmenu-input" autoFocus placeholder="Search a parent…" value={q} onChange={e => setQ(e.target.value)} />
                    <div className="nmenu-move-list">
                      <button className="nmenu-item" onClick={() => moveTo(null)}>— Top level (project) —</button>
                      {targets.filter(t => t.label.toLowerCase().includes(q.toLowerCase())).slice(0, 40).map(t => (
                        <button key={t.id} className="nmenu-item nmenu-move-item" onClick={() => moveTo(t.id)}>
                          {t.node.image ? (
                            <span className="nmenu-move-ic nmenu-move-img" style={{ backgroundImage: `url(${t.node.image})` }} />
                          ) : (
                            <span className="nmenu-move-ic" style={{ background: tagBg(t.node.color ?? 'gray'), color: tagFg(t.node.color ?? 'gray') }}><Icon name={t.node.icon ?? 'ti-folder'} /></span>
                          )}
                          <span className="nmenu-move-lbl">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  )
}
