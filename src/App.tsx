import { useEffect, useLayoutEffect, useRef } from 'react'
import { useStore } from './store/useStore'
import { useNav } from './hooks/useNav'
import { AppHeader } from './components/AppHeader'
import { ProjectsHome } from './components/ProjectsHome'
import ProjectPage from './components/ProjectPage'
import { MyWorkPage } from './components/MyWorkPage'
import { CardModal } from './components/CardModal'
import { NewProjectModal } from './components/NewProjectModal'
import { useTransfer } from './hooks/useTransfer'
import { ExportModal } from './components/ExportModal'
import { ImportModal } from './components/ImportModal'
import { AboutModal } from './components/AboutModal'
import { SettingsModal } from './components/SettingsModal'
import { OnboardingModal } from './components/OnboardingModal'
import { SearchPalette } from './components/SearchPalette'
import { ActivityFeed } from './components/ActivityFeed'
import { NudgeWidget } from './components/NudgeWidget'
import { ConfirmDialog } from './components/ConfirmDialog'
import { CompletionSummary } from './components/CompletionSummary'
import { useOnboarding } from './hooks/useOnboarding'
import { useQuickCapture } from './hooks/useQuickCapture'
import { QuickCapture } from './components/QuickCapture'
import { buildWork } from './lib/execution'
import { setDockBadge } from './lib/desktopWidget'
import { DEFAULT_WORKSPACE_ID } from './lib/serialize'
import { isTauri } from './lib/platform'
import { initRouter } from './lib/router'
import { initTabs, useTabs } from './hooks/useTabs'
import { initTheme, useTheme } from './hooks/useTheme'

export default function App() {
  const ready = useStore(s => s.ready)
  const roots = useStore(s => s.doc.roots)
  const path = useNav(s => s.path)
  // Subscribe so a Light/Dark/System change re-renders the tree and refreshes
  // JS-computed tint colors (tags, avatars) alongside the CSS variables.
  useTheme(s => s.dark)
  const onboarded = useStore(s => !!s.doc.profile?.onboarded)
  const myWork = useTabs(s => s.tabs.find(t => t.id === s.activeId)?.kind === 'mywork')
  useEffect(() => { initTheme(); void useStore.getState().init().then(() => { initRouter(); initTabs() }) }, [])
  // First launch → open onboarding.
  useEffect(() => { if (ready && !onboarded) useOnboarding.getState().show() }, [ready, onboarded])
  // The reminder widget runs in a separate window and routes its changes here
  // (the main window is the single writer of the data file).
  useEffect(() => {
    if (!isTauri()) return
    const uns: (() => void)[] = []
    void (async () => {
      const { listen } = await import('@tauri-apps/api/event')
      const { QUICK_ADD_EVENT, TOGGLE_DONE_EVENT, SNOOZE_EVENT } = await import('./lib/desktopWidget')
      uns.push(await listen(QUICK_ADD_EVENT, () => useQuickCapture.getState().show()))
      uns.push(await listen<{ id: string }>(TOGGLE_DONE_EVENT, e => useStore.getState().toggleDone(e.payload.id)))
      uns.push(await listen<{ id: string; dueDate: string }>(SNOOZE_EVENT, e => {
        useStore.getState().patch(e.payload.id, { dueDate: e.payload.dueDate })
        useStore.getState().logActivity(e.payload.id, 'Snoozed to tomorrow')
      }))
    })()
    return () => uns.forEach(u => u())
  }, [])
  // Ambient dock badge: overdue + due-today count for the active WorkBase.
  const activeWs = useStore(s => s.doc.activeWorkspace)
  const badge = (() => {
    if (!ready) return 0
    const w = buildWork(roots.filter(r => (r.workspace ?? DEFAULT_WORKSPACE_ID) === activeWs))
    return w.overdue.length + w.today.length
  })()
  useEffect(() => { void setDockBadge(badge) }, [badge])

  // Fixed-height views (the Flow viewport, the board) size themselves against
  // the window minus the top chrome. Measure that chrome live into a CSS
  // variable rather than hard-coding it, so the flow controls at the viewport's
  // bottom edge stay on-screen whatever the header ends up measuring.
  const chromeRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = chromeRef.current
    if (!el) return
    const apply = () => document.documentElement.style.setProperty('--wb-top-chrome', `${el.offsetHeight}px`)
    apply()
    if (typeof ResizeObserver === 'undefined') return // e.g. jsdom in tests
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!ready) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div ref={chromeRef}>
          <AppHeader
            roots={roots}
            path={path}
            onHome={() => useTabs.getState().goHome()}
            onGoto={i => useNav.getState().goto(i)}
            onExport={() => useTransfer.getState().showAccountExport()}
            onImport={() => useTransfer.getState().showImport()}
          />
        </div>
        <div style={{ padding: '16px 32px 28px' }}>
          {myWork ? <MyWorkPage /> : path.length === 0 ? <ProjectsHome /> : <ProjectPage />}
        </div>
      </div>
      <CardModal />
      <NewProjectModal />
      <ExportModal />
      <ImportModal />
      <AboutModal />
      <QuickCapture />
      <SettingsModal />
      <SearchPalette />
      <ActivityFeed />
      <OnboardingModal />
      <ConfirmDialog />
      <CompletionSummary />
      {/* In the desktop app the reminder lives in its own always-on-top window;
          in the browser it floats in-app. */}
      {!isTauri() ? <NudgeWidget /> : null}
    </div>
  )
}
