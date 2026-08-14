import { act, render, screen } from '@testing-library/react'
import App from './App'
import { useStore } from './store/useStore'
import { emptyDocument } from './lib/serialize'

test('renders the app shell once the store is ready', async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })

  await act(async () => {
    render(<App />)
  })

  expect(screen.getByText('Default')).toBeInTheDocument()
  expect(screen.getByTestId('projects-home')).toBeInTheDocument()
})
