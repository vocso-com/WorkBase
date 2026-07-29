import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app name', () => {
  render(<App />)
  expect(screen.getByText('Manage')).toBeInTheDocument()
})
