import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { useNav } from './hooks/useNav'
import { useDetail } from './hooks/useDetail'
import { AppHeader } from './components/AppHeader'
import { ProjectsHome } from './components/ProjectsHome'
import ProjectPage from './components/ProjectPage'
import { MyWorkPage } from './components/MyWorkPage'
import { CardModal } from './components/CardModal'
import { NewProjectModal } from './components/NewProjectModal'
import { SettingsModal } from './components/SettingsModal'
import { OnboardingModal } from './components/OnboardingModal'
import { SearchPalette } from './components/SearchPalette'
import { ActivityFeed } from './components/ActivityFeed'
import { NudgeWidget } from './components/NudgeWidget'
import { VerifyNudge } from './components/VerifyNudge'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useOnboarding } from './hooks/useOnboarding'
import { useQuickCapture } from './hooks/useQuickCapture'
import { QuickCapture } from './components/QuickCapture'
import { buildWork } from './lib/execution'
import { setDockBadge } from './lib/desktopWidget'
import { DEFAULT_WORKSPACE_ID } from './lib/serialize'
import { exportDoc, importDoc } from './lib/transfer'
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
  const hasEmail = useStore(s => !!s.doc.profile?.userEmail)
  const myWork = useTabs(s => s.tabs.find(t => t.id === s.activeId)?.kind === 'mywork')
  useEffect(() => { initTheme(); void useStore.getState().init().then(() => { initRouter(); initTabs() }) }, [])
  // First launch (no email captured yet) → open onboarding.
  useEffect(() => { if (ready && !hasEmail) useOnboarding.getState().show() }, [ready, hasEmail])
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

  if (!ready) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <VerifyNudge />
        <AppHeader
          roots={roots}
          path={path}
          onHome={() => useTabs.getState().goHome()}
          onGoto={i => useNav.getState().goto(i)}
          onExport={async () => {
            try {
              await exportDoc(useStore.getState().doc)
            } catch (e) {
              alert((e as Error).message)
            }
          }}
          onImport={async () => {
            try {
              const d = await importDoc()
              if (d) {
                useStore.getState().replaceDoc(d)
                useNav.getState().home()
                useDetail.getState().close()
              }
            } catch (e) {
              alert((e as Error).message)
            }
          }}
        />
        <div style={{ padding: '16px 32px 28px' }}>
          {myWork ? <MyWorkPage /> : path.length === 0 ? <ProjectsHome /> : <ProjectPage />}
        </div>
      </div>
      <CardModal />
      <NewProjectModal />
      <QuickCapture />
      <SettingsModal />
      <SearchPalette />
      <ActivityFeed />
      <OnboardingModal />
      <ConfirmDialog />
      {/* In the desktop app the reminder lives in its own always-on-top window;
          in the browser it floats in-app. */}
      {!isTauri() ? <NudgeWidget /> : null}
    </div>
  )
}
