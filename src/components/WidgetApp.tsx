import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { buildWork } from '../lib/execution'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { positionWidget, setWidgetVisible } from '../lib/desktopWidget'
import { NudgeWidget } from './NudgeWidget'

/**
 * The standalone reminder widget (loaded by the Tauri always-on-top window at
 * #/~widget). It boots its own store from disk, polls for changes made in the
 * main window, and shows/hides + positions the native window based on whether
 * there's anything worth surfacing.
 */
export function WidgetApp() {
  const ready = useStore(s => s.ready)
  const roots = useStore(s => s.doc.roots)
  const activeWs = useStore(s => s.doc.activeWorkspace)
  const profile = useStore(s => s.doc.profile)

  // Boot + poll the document (the main window is the source of truth on disk).
  useEffect(() => {
    void useStore.getState().init()
    const t = setInterval(() => { void useStore.getState().reload() }, 20000)
    const onFocus = () => { void useStore.getState().reload() }
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [])

  const wsRoots = roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs)
  const work = buildWork(wsRoots)
  const remindersOn = profile?.nudgeReminders !== false
  const myWorkOn = !!profile?.nudgeMyWork
  const hasContent = ready && ((remindersOn && work.overdue.length + work.today.length > 0) || (myWorkOn && work.total > 0))

  // Reflect content into the native window: show + dock when there's something.
  useEffect(() => {
    if (!ready) return
    void (async () => {
      if (hasContent) { await positionWidget(); await setWidgetVisible(true) }
      else { await setWidgetVisible(false) }
    })()
  }, [ready, hasContent])

  return (
    <div className="widget-shell">
      <NudgeWidget standalone />
    </div>
  )
}
