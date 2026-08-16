import { useEffect, useState } from 'react'
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
import { AppLock } from './components/AppLock'
import { checkStatus } from './lib/registry'
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
  const email = useStore(s => s.doc.profile?.userEmail)
  const emailVerified = useStore(s => !!s.doc.profile?.emailVerified)
  const myWork = useTabs(s => s.tabs.find(t => t.id === s.activeId)?.kind === 'mywork')
  const [lock, setLock] = useState<string | null>(null)
  useEffect(() => { initTheme(); void useStore.getState().init().then(() => { initRouter(); initTabs() }) }, [])
  // First launch (no email captured yet) → open onboarding.
  useEffect(() => { if (ready && !hasEmail) useOnboarding.getState().show() }, [ready, hasEmail])
  // Once-a-day registry check → lock the app if the server says so (disabled,
  // or unverified past the grace period). No-ops when there's no endpoint/email.
  useEffect(() => {
    if (!ready) return
    void checkStatus(email).then(r => {
      setLock(r.blocked ? r.reason : null)
      // The registry is the authority on verification. Without this the local
      // flag is written once at OTP time and never revisited, so the two can
      // drift apart permanently with the app always believing its own copy.
      // `undefined` means we never got an answer (no endpoint, offline) — leave
      // the local value alone rather than clearing a real verification.
      if (r.verified !== undefined && r.verified !== emailVerified) {
        useStore.getState().setProfile({ emailVerified: r.verified })
      }
    })
  }, [ready, email, emailVerified])
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
  if (lock) return <><AppLock reason={lock} /><OnboardingModal /><ConfirmDialog /></>

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <VerifyNudge />
        <AppHeader
          roots={roots}
          path={path}
          onHome={() => useTabs.getState().goHome()}
          onGoto={i => useNav.getState().goto(i)}
          onExport={() => useTransfer.getState().showAccountExport()}
          onImport={() => useTransfer.getState().showImport()}
        />
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
      {/* In the desktop app the reminder lives in its own always-on-top window;
          in the browser it floats in-app. */}
      {!isTauri() ? <NudgeWidget /> : null}
    </div>
  )
}
