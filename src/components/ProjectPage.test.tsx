import { render, screen, act } from '@testing-library/react'
import ProjectPage from './ProjectPage'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('renders overview and a module card', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('SampleRoom') })
  act(() => { useStore.getState().addChildNode(pid, 'Testing') })
  act(() => { useNav.getState().home(); useNav.getState().open(pid) })
  render(<ProjectPage />)
  expect(screen.getByText('SampleRoom')).toBeInTheDocument()
  expect(screen.getByText('Testing')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Board$/ })).toBeInTheDocument()
})
