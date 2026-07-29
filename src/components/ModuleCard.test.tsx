import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectPage from './ProjectPage'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
  act(() => { useNav.getState().home() })
})

function buildFixture() {
  let pid = ''
  let moduleWithChildId = ''
  let leafModuleId = ''
  act(() => {
    pid = useStore.getState().addProject('SampleRoom')
    moduleWithChildId = useStore.getState().addChildNode(pid, 'Has Children')
    useStore.getState().addChildNode(moduleWithChildId, 'Sub Item')
    leafModuleId = useStore.getState().addChildNode(pid, 'Leaf Module')
  })
  return { pid, moduleWithChildId, leafModuleId }
}

test('clicking a module card with children drills into it', async () => {
  const user = userEvent.setup()
  const { pid, moduleWithChildId } = buildFixture()
  act(() => { useNav.getState().open(pid) })
  render(<ProjectPage />)

  await user.click(screen.getByText('Has Children'))

  expect(useNav.getState().path).toEqual([pid, moduleWithChildId])
})

test('clicking a module card with no children does not drill in', async () => {
  const user = userEvent.setup()
  const { pid } = buildFixture()
  act(() => { useNav.getState().open(pid) })
  render(<ProjectPage />)

  await user.click(screen.getByText('Leaf Module'))

  expect(useNav.getState().path).toEqual([pid])
})

test('toggling a checklist checkbox updates done/total and does not drill in', async () => {
  const user = userEvent.setup()
  const { pid } = buildFixture()
  act(() => { useNav.getState().open(pid) })
  render(<ProjectPage />)

  expect(screen.getByText('0/1')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'toggle done' }))

  expect(screen.getByText('1/1')).toBeInTheDocument()
  expect(useNav.getState().path).toEqual([pid])
})
