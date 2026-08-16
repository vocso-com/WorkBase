import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectPage from './ProjectPage'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { useDetail } from '../hooks/useDetail'
import { useView } from '../hooks/useView'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
  // ModuleCard is a Board component, and Flow is now the default view.
  act(() => { useNav.getState().home(); useView.getState().setView('board') })
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

test('clicking a module card body with children drills into it', async () => {
  const user = userEvent.setup()
  const { pid, moduleWithChildId } = buildFixture()
  act(() => { useNav.getState().open(pid) })
  render(<ProjectPage />)

  // Click the done/total counter (card body), not the title — the title
  // always opens the detail panel now, so drill-in is exercised via a
  // non-title part of the card.
  await user.click(screen.getByText('0/1'))

  expect(useNav.getState().path).toEqual([pid, moduleWithChildId])
})

test('clicking a module title always opens the detail panel, even with children', async () => {
  const user = userEvent.setup()
  const { pid, moduleWithChildId } = buildFixture()
  act(() => { useNav.getState().open(pid) })
  render(<ProjectPage />)

  await user.click(screen.getByText('Has Children'))

  expect(useDetail.getState().openId).toBe(moduleWithChildId)
  expect(useNav.getState().path).toEqual([pid])
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

test('a non-leaf child row has no toggle checkbox, a leaf child row does', async () => {
  let pid = ''
  let moduleId = ''
  let nonLeafChildId = ''
  let leafChildId = ''
  act(() => {
    pid = useStore.getState().addProject('SampleRoom')
    moduleId = useStore.getState().addChildNode(pid, 'Module')
    nonLeafChildId = useStore.getState().addChildNode(moduleId, 'Has Grandchild')
    useStore.getState().addChildNode(nonLeafChildId, 'Grandchild')
    leafChildId = useStore.getState().addChildNode(moduleId, 'Leaf Child')
  })
  act(() => { useNav.getState().open(pid) })
  render(<ProjectPage />)

  const nonLeafRow = screen.getByTestId(`child-row-${nonLeafChildId}`)
  expect(within(nonLeafRow).queryByRole('button', { name: 'toggle done' })).not.toBeInTheDocument()

  const leafRow = screen.getByTestId(`child-row-${leafChildId}`)
  expect(within(leafRow).getByRole('button', { name: 'toggle done' })).toBeInTheDocument()
})
