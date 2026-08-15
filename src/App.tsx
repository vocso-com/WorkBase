import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { useNav } from './hooks/useNav'
import { useDetail } from './hooks/useDetail'
import { AppHeader } from './components/AppHeader'
import { ProjectsHome } from './components/ProjectsHome'
import ProjectPage from './components/ProjectPage'
import { CardModal } from './components/CardModal'
import { NewProjectModal } from './components/NewProjectModal'
import { SettingsModal } from './components/SettingsModal'
import { OnboardingModal } from './components/OnboardingModal'
import { VerifyNudge } from './components/VerifyNudge'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useOnboarding } from './hooks/useOnboarding'
import { exportDoc, importDoc } from './lib/transfer'
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
  useEffect(() => { initTheme(); void useStore.getState().init().then(() => { initRouter(); initTabs() }) }, [])
  // First launch (no email captured yet) → open onboarding.
  useEffect(() => { if (ready && !hasEmail) useOnboarding.getState().show() }, [ready, hasEmail])

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
          {path.length === 0 ? <ProjectsHome /> : <ProjectPage />}
        </div>
      </div>
      <CardModal />
      <NewProjectModal />
      <SettingsModal />
      <OnboardingModal />
      <ConfirmDialog />
    </div>
  )
}
