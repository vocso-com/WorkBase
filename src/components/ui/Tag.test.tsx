import { render, screen } from '@testing-library/react'
import { Tag } from './Tag'

test('renders tag name', () => {
  render(<Tag tag={{ name: 'SEO', color: 'blue' }} />)
  expect(screen.getByText('SEO')).toBeInTheDocument()
})
