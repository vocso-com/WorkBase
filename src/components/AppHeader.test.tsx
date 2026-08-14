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

test('shows the wordmark at home and no breadcrumb', () => {
  render(headerFor([]))
  expect(screen.getByText('Manage')).toBeInTheDocument()
  expect(screen.queryByText('Projects')).not.toBeInTheDocument()
})

test('shows the project chip and view menu when inside a project', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('SampleRoom') })
  render(headerFor([pid]))
  expect(screen.getByText('Projects')).toBeInTheDocument()
  // Project title appears in the merged identity chip
  expect(screen.getByText('SampleRoom')).toBeInTheDocument()
  // The view dropdown lives in the header now
  expect(screen.getByText('Board')).toBeInTheDocument()
})
