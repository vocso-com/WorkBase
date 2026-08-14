import { render, screen, act, fireEvent } from '@testing-library/react'
import { NewProjectModal } from './NewProjectModal'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { useNewProject } from '../hooks/useNewProject'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
  act(() => { useNav.getState().home(); useNewProject.getState().hide() })
})

test('renders nothing when closed', () => {
  const { container } = render(<NewProjectModal />)
  expect(container.firstChild).toBeNull()
})

test('picking a template creates a seeded project and navigates into it', () => {
  act(() => { useNewProject.getState().show() })
  render(<NewProjectModal />)
  // Built-in templates are shown
  expect(screen.getByText('Mobile App')).toBeInTheDocument()
  act(() => { fireEvent.click(screen.getByText('Mobile App')) })

  const roots = useStore.getState().doc.roots
  expect(roots).toHaveLength(1)
  expect(roots[0].children.length).toBeGreaterThan(0)
  // Navigated into the new project, modal closed
  expect(useNav.getState().path).toEqual([roots[0].id])
  expect(useNewProject.getState().open).toBe(false)
})

test('blank project uses the typed name', () => {
  act(() => { useNewProject.getState().show() })
  render(<NewProjectModal />)
  fireEvent.change(screen.getByPlaceholderText(/uses the template name/i), { target: { value: 'My Thing' } })
  act(() => { fireEvent.click(screen.getByText('Blank project')) })
  const roots = useStore.getState().doc.roots
  expect(roots[0].title).toBe('My Thing')
  expect(roots[0].children).toHaveLength(0)
})
