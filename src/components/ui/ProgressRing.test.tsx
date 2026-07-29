import { render, screen } from '@testing-library/react'
import { ProgressRing } from './ProgressRing'

test('renders the percentage', () => {
  render(<ProgressRing value={67} color="teal" size={42} />)
  expect(screen.getByText('67%')).toBeInTheDocument()
})
