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
import { ConfirmDialog } from './components/ConfirmDialog'
import { TabBar } from './components/TabBar'
import { exportDoc, importDoc } from './lib/transfer'
import { initRouter } from './lib/router'
import { initTabs, useTabs } from './hooks/useTabs'

export default function App() {
  const ready = useStore(s => s.ready)
  const roots = useStore(s => s.doc.roots)
  const path = useNav(s => s.path)
  useEffect(() => { void useStore.getState().init().then(() => { initRouter(); initTabs() }) }, [])

  if (!ready) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
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
        <TabBar />
        <div style={{ padding: '16px 32px 28px' }}>
          {path.length === 0 ? <ProjectsHome /> : <ProjectPage />}
        </div>
      </div>
      <CardModal />
      <NewProjectModal />
      <SettingsModal />
      <ConfirmDialog />
    </div>
  )
}
