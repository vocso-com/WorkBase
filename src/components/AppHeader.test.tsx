import { render, screen, act } from '@testing-library/react'
import { AppHeader } from './AppHeader'
import { useStore } from '../store/useStore'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

function headerFor(path: string[]) {
  const roots = useStore.getState().doc.roots
  return <AppHeader roots={roots} path={path} onHome={() => {}} onGoto={() => {}} onExport={() => {}} onImport={() => {}} />
}

test('shows the wordmark and a Projects sub-bar at home', () => {
  render(headerFor([]))
  expect(screen.getByText('Default')).toBeInTheDocument()
  // Home carries a minimal "Projects" sub-bar so its tab connects like a project's
  expect(screen.getByText('Projects')).toBeInTheDocument()
})

test('shows the project chip and view menu when inside a project', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('Acme Website') })
  render(headerFor([pid]))
  expect(screen.getByText('Projects')).toBeInTheDocument()
  // Project title appears in the merged identity chip
  expect(screen.getByText('Acme Website')).toBeInTheDocument()
  // The view dropdown lives in the header now, showing the default view.
  expect(screen.getByText('Flow')).toBeInTheDocument()
})
