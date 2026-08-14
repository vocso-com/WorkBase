import { render, screen, act } from '@testing-library/react'
import { ProjectsHome } from './ProjectsHome'
import { useStore } from '../store/useStore'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('shows a project under its status lane', () => {
  act(() => {
    const id = useStore.getState().addProject('SampleRoom')
    useStore.getState().setStatus(id, 'doing')
  })
  const { container } = render(<ProjectsHome />)
  expect(screen.getByText('SampleRoom')).toBeInTheDocument()
  // Lane header carries the status label (the card now shows one too, hence the scope)
  const laneHead = container.querySelector('.lanehead')
  expect(laneHead?.textContent).toContain('In progress')
})
