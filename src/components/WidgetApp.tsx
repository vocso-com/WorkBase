import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { buildWork } from '../lib/execution'
import { DEFAULT_WORKSPACE_ID } from '../lib/serialize'
import { fitWidget, setWidgetVisible } from '../lib/desktopWidget'
import { isTauri } from '../lib/platform'
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
  const shellRef = useRef<HTMLDivElement>(null)

  // Boot + poll the document (the main window is the source of truth on disk).
  useEffect(() => {
    void useStore.getState().init()
    const t = setInterval(() => { void useStore.getState().reload() }, 20000)
    const onFocus = () => { void useStore.getState().reload() }
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [])

  // Keep the native window sized to the card (so a transparent window shows only
  // the rounded card and collapsing shrinks it).
  useEffect(() => {
    if (!isTauri()) return
    const shell = shellRef.current
    if (!shell) return
    const measure = () => {
      const card = shell.querySelector('.nudge') as HTMLElement | null
      if (!card) return
      const r = card.getBoundingClientRect()
      void fitWidget(Math.ceil(r.width) + 28, Math.ceil(r.height) + 28)
    }
    const ro = new ResizeObserver(measure)
    const card = shell.querySelector('.nudge')
    if (card) ro.observe(card)
    // Re-observe if the card mounts/unmounts (content appears/disappears).
    const mo = new MutationObserver(() => {
      const c = shell.querySelector('.nudge')
      if (c) { ro.disconnect(); ro.observe(c); measure() }
    })
    mo.observe(shell, { childList: true, subtree: true })
    measure()
    return () => { ro.disconnect(); mo.disconnect() }
  }, [])

  const wsRoots = roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs)
  const work = buildWork(wsRoots)
  const remindersOn = profile?.nudgeReminders !== false
  const myWorkOn = !!profile?.nudgeMyWork
  const hasContent = ready && ((remindersOn && work.overdue.length + work.today.length > 0) || (myWorkOn && work.total > 0))

  // Reflect content into the native window: show when there's something, hide
  // when there isn't (sizing/positioning is handled by the observer above).
  useEffect(() => {
    if (!ready) return
    void setWidgetVisible(hasContent)
  }, [ready, hasContent])

  return (
    <div className="widget-shell" ref={shellRef}>
      <NudgeWidget standalone />
    </div>
  )
}
