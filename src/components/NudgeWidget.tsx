import { buildWork } from '../lib/execution'
import { useStore } from '../store/useStore'
import { useNudge } from '../hooks/useNudge'
import { useTabs } from '../hooks/useTabs'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { goToNode } from '../lib/goto'
import { focusMain, setWidgetVisible } from '../lib/desktopWidget'
import { dueInfo } from '../lib/due'
import { hex } from '../theme'
import { Checkbox } from './ui/Checkbox'
import { Icon } from './ui/Icon'

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

  const remindersOn = profile?.nudgeReminders !== false // default on
  const myWorkOn = !!profile?.nudgeMyWork

  const wsRoots = roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs)
  const work = buildWork(wsRoots)
  const reminders = [...work.overdue, ...work.today]
  const shown = reminders.slice(0, 4)

  const hasReminders = remindersOn && reminders.length > 0
  const hasNudge = myWorkOn && work.total > 0
  if ((!standalone && closed) || (!hasReminders && !hasNudge)) return null

  // In the desktop widget, actions hand off to the main window; in-app they
  // navigate directly.
  const openNode = (id: string) => { if (standalone) { void focusMain() } else { goToNode(id) } }
  const openMyWork = () => { if (standalone) { void focusMain() } else { useTabs.getState().openMyWork() } }
  const dismiss = () => { if (standalone) { void setWidgetVisible(false) } else { useNudge.getState().close() } }

  return (
    <div className={`nudge${standalone ? ' nudge-standalone' : ''}`} role="status" aria-label="Reminders">
      <div className="nudge-head" data-tauri-drag-region>
        <img className="nudge-logo" src="/workbase-logo.png" alt="" />
        <span className="nudge-title">{hasReminders ? 'Reminders' : 'My Work'}</span>
        <button className="nudge-x" onClick={dismiss} aria-label="Dismiss"><Icon name="ti-x" /></button>
      </div>

      {hasNudge ? (
        <button className="nudge-summary" onClick={openMyWork}>
          <span className="nudge-stat"><b>{work.overdue.length}</b> overdue</span>
          <span className="nudge-stat"><b>{work.today.length}</b> today</span>
          <span className="nudge-stat"><b>{work.focus.length || work.anytime.length}</b> ready</span>
          <Icon name="ti-chevron-right" />
        </button>
      ) : null}

      {hasReminders ? (
        <div className="nudge-list">
          {shown.map(i => {
            const di = dueInfo(i.node.dueDate)
            return (
              <div className="nudge-row" key={i.node.id}>
                <span className="nudge-check" onPointerDown={e => e.stopPropagation()}>
                  <Checkbox status={i.node.status} onToggle={() => useStore.getState().toggleDone(i.node.id)} />
                </span>
                <button className="nudge-item" onClick={() => openNode(i.node.id)}>
                  <span className="nudge-item-title">{i.node.title}</span>
                  <span className="nudge-item-sub" style={{ ['--pc' as string]: hex(i.rootColor) }}>{i.rootTitle}</span>
                </button>
                {di ? <span className={`nudge-due nudge-due-${di.tone}`}>{di.label}</span> : null}
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
