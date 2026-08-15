import { useEffect, useRef, useState } from 'react'
import type { Node } from '../types'
import { buildWork } from '../lib/execution'
import { useStore } from '../store/useStore'
import { useNudge } from '../hooks/useNudge'
import { useTabs } from '../hooks/useTabs'
import { useQuickCapture } from '../hooks/useQuickCapture'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { goToNode } from '../lib/goto'
import { focusMain, setWidgetVisible, quickAddFromWidget, commitToMain, startWidgetDrag, TOGGLE_DONE_EVENT, SNOOZE_EVENT } from '../lib/desktopWidget'
import { dueInfo } from '../lib/due'
import { hex } from '../theme'
import { Checkbox } from './ui/Checkbox'
import { Icon } from './ui/Icon'

function headline(od: number, td: number): string {
  if (od > 0) return 'Let’s clear what’s slipping'
  if (td > 0) return 'A few due today — you’ve got this'
  return 'You’re all caught up ✨'
}

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** How many tasks were completed today (for the momentum streak). */
function doneToday(roots: Node[]): number {
  const t = new Date().toDateString()
  let n = 0
  const walk = (node: Node) => {
    if (node.status === 'done' && (node.activities ?? []).some(a => a.text === 'Marked complete' && new Date(a.at).toDateString() === t)) n++
    node.children.forEach(walk)
  }
  roots.forEach(walk)
  return n
}

/**
 * A small, sticky reminder / My Work nudge. In the web build it floats in the
 * bottom-right of the app; in the desktop build the same component fills a
 * native always-on-top window (`standalone`) that sits above every app, so
 * its actions target the main window instead of navigating in place.
 */
export function NudgeWidget({ standalone }: { standalone?: boolean } = {}) {
  const roots = useStore(s => s.doc.roots)
  const activeWs = useStore(s => s.doc.activeWorkspace)
  const profile = useStore(s => s.doc.profile)
  const closed = useNudge(s => s.closed)
  const collapsed = useNudge(s => s.collapsed)

  const wsRoots = roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs)
  const work = buildWork(wsRoots)
  const done = doneToday(wsRoots)

  // Momentum: celebrate the moment a task gets ticked off.
  const prevDone = useRef(done)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (done > prevDone.current) {
      setCelebrate(true)
      const t = setTimeout(() => setCelebrate(false), 1300)
      prevDone.current = done
      return () => clearTimeout(t)
    }
    prevDone.current = done
  }, [done])

  const remindersOn = profile?.nudgeReminders !== false // default on
  const myWorkOn = !!profile?.nudgeMyWork
  const firstName = profile?.userName?.trim().split(/\s+/)[0]
  const hour = new Date().getHours()
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  const greeting = firstName ? `Good ${part}, ${firstName}` : `Good ${part}`

  const reminders = [...work.overdue, ...work.today]
  const shown = reminders.slice(0, 5)
  const ready = work.focus.length || work.anytime.length

  const hasReminders = remindersOn && reminders.length > 0
  const hasNudge = myWorkOn && work.total > 0
  if ((!standalone && closed) || (!hasReminders && !hasNudge)) return null

  // In the desktop widget, actions hand off to the main window; in-app they
  // navigate directly.
  const openNode = (id: string) => { if (standalone) { void focusMain() } else { goToNode(id) } }
  const openMyWork = () => { if (standalone) { void focusMain() } else { useTabs.getState().openMyWork() } }
  const dismiss = () => { if (standalone) { void setWidgetVisible(false) } else { useNudge.getState().close() } }
  const toggle = () => useNudge.getState().toggleCollapsed()
  const quickAdd = () => { if (standalone) { void quickAddFromWidget() } else { useQuickCapture.getState().show() } }
  // Optimistic local update for instant feedback; the main window (single
  // writer) applies the authoritative, persisted change.
  const tickDone = (id: string) => {
    useStore.getState().toggleDone(id)
    if (standalone) void commitToMain(TOGGLE_DONE_EVENT, { id })
  }

  return (
    <div className={`nudge${standalone ? ' nudge-standalone' : ''}${collapsed ? ' is-collapsed' : ''}${celebrate ? ' is-celebrating' : ''}`} role="status" aria-label="Reminders">
      <div className="nudge-head" data-tauri-drag-region onMouseDown={standalone ? startWidgetDrag : undefined}>
        <img className="nudge-logo" src="/workbase-logo.png" alt="" />
        <div className="nudge-head-txt">
          <span className="nudge-title">{greeting}</span>
          <span className="nudge-sub">{hasReminders ? headline(work.overdue.length, work.today.length) : 'Here’s what’s on your plate'}</span>
        </div>
        {done > 0 ? <span className="nudge-fire" title={`${done} done today`}>🔥 {done}</span> : null}
        <button className="nudge-ic" onClick={quickAdd} aria-label="Add task" title="Add task"><Icon name="ti-plus" /></button>
        <button className="nudge-ic" onClick={toggle} aria-label={collapsed ? 'Expand' : 'Collapse'} title={collapsed ? 'Expand' : 'Collapse'}>
          <Icon name={collapsed ? 'ti-chevron-down' : 'ti-chevron-up'} />
        </button>
        <button className="nudge-ic" onClick={dismiss} aria-label="Hide"><Icon name="ti-x" /></button>
      </div>

      <button className="nudge-stats" onClick={openMyWork} title="Open My Work">
        {work.overdue.length > 0 ? <span className="nudge-pill pill-overdue"><b>{work.overdue.length}</b> overdue</span> : null}
        {work.today.length > 0 ? <span className="nudge-pill pill-today"><b>{work.today.length}</b> today</span> : null}
        <span className="nudge-pill pill-ready"><b>{ready}</b> ready</span>
        <Icon name="ti-arrow-right" className="nudge-stats-go" />
      </button>

      {!collapsed && hasReminders ? (
        <div className="nudge-list">
          {shown.map(i => {
            const di = dueInfo(i.node.dueDate)
            return (
              <div className="nudge-card" key={i.node.id} style={{ ['--pc' as string]: hex(i.rootColor) }}>
                <span className="nudge-dot" title={i.rootTitle} />
                <span className="nudge-check" onPointerDown={e => e.stopPropagation()}>
                  <Checkbox status={i.node.status} onToggle={() => tickDone(i.node.id)} />
                </span>
                <button className="nudge-card-main" onClick={() => openNode(i.node.id)}>
                  <span className="nudge-card-title">{i.node.title}</span>
                  <span className="nudge-card-sub">{i.rootTitle}</span>
                </button>
                {di ? <span className={`nudge-due nudge-due-${di.tone}`}>{di.label}</span> : null}
                <SnoozeButton nodeId={i.node.id} standalone={standalone} />
              </div>
            )
          })}
          {reminders.length > shown.length ? (
            <button className="nudge-more" onClick={openMyWork}>+{reminders.length - shown.length} more · Open My Work</button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Push a reminder to tomorrow in one tap — no need to open the task. (Arbitrary
 * dates still live in the task's due-date picker; a dropdown here would be
 * clipped by the auto-sized widget window.)
 */
function SnoozeButton({ nodeId, standalone }: { nodeId: string; standalone?: boolean }) {
  const snooze = () => {
    const d = new Date(); d.setDate(d.getDate() + 1)
    const dueDate = localISO(d)
    useStore.getState().patch(nodeId, { dueDate })
    useStore.getState().logActivity(nodeId, 'Snoozed to tomorrow')
    if (standalone) void commitToMain(SNOOZE_EVENT, { id: nodeId, dueDate })
  }
  return (
    <button
      className="nudge-snooze"
      title="Snooze to tomorrow"
      aria-label="Snooze to tomorrow"
      onClick={e => { e.stopPropagation(); snooze() }}
      onPointerDown={e => e.stopPropagation()}
    >
      <Icon name="ti-clock" />
    </button>
  )
}
