import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { useNav } from './hooks/useNav'
import { TopBar } from './components/TopBar'
import { Breadcrumb } from './components/Breadcrumb'
import { ProjectsHome } from './components/ProjectsHome'
import ProjectPage from './components/ProjectPage'

export default function App() {
  const ready = useStore(s => s.ready)
  const roots = useStore(s => s.doc.roots)
  const path = useNav(s => s.path)
  useEffect(() => { void useStore.getState().init() }, [])

  if (!ready) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>

  return (
    <>
      <TopBar onExport={() => {}} onImport={() => {}} />
      <Breadcrumb roots={roots} path={path}
        onHome={() => useNav.getState().home()} onGoto={i => useNav.getState().goto(i)} />
      <div style={{ padding: '12px 28px 70px', maxWidth: 1120 }}>
        {path.length === 0 ? <ProjectsHome /> : <ProjectPage />}
      </div>
    </>
  )
}
