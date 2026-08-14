import { render, screen, act } from '@testing-library/react'
import ProjectPage from './ProjectPage'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { useView } from '../hooks/useView'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
  act(() => { useView.getState().setView('board') })
})

test('renders the active view (module card in board view)', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('SampleRoom') })
  act(() => { useStore.getState().addChildNode(pid, 'Testing') })
  act(() => { useNav.getState().home(); useNav.getState().open(pid) })
  render(<ProjectPage />)
  // The view toggle + project name now live in the merged header (AppHeader).
  // ProjectPage renders just the active view; board shows the module card.
  expect(screen.getByText('Testing')).toBeInTheDocument()
})
