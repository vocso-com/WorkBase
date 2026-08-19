import { render, screen } from '@testing-library/react'
import { ProgressRing } from './ProgressRing'

test('renders the percentage', () => {
  render(<ProgressRing value={67} color="teal" size={42} />)
  expect(screen.getByText('67%')).toBeInTheDocument()
})

test('draws one arc per stage when given segments', () => {
  const { container } = render(
    <ProgressRing
      value={50}
      color="#000"
      size={54}
      segments={[{ id: 'done', color: '#0a0', value: 50 }, { id: 'blocked', color: '#a00', value: 25 }]}
    />,
  )
  const arcs = [...container.querySelectorAll('circle')].filter(c => c.getAttribute('stroke') !== 'var(--line)')
  expect(arcs.map(a => a.getAttribute('stroke'))).toEqual(['#0a0', '#a00'])
})

test('falls back to a single arc in the given colour without segments', () => {
  const { container } = render(<ProgressRing value={50} color="#123456" size={54} />)
  const arcs = [...container.querySelectorAll('circle')].filter(c => c.getAttribute('stroke') !== 'var(--line)')
  expect(arcs).toHaveLength(1)
  expect(arcs[0].getAttribute('stroke')).toBe('#123456')
})

test('the label keeps clear of the arc', () => {
  const size = 54
  const { container } = render(<ProgressRing value={100} color="#000" size={size} />)
  const text = container.querySelector('text')!
  const fontSize = Number(text.getAttribute('font-size'))
  const stroke = Number(container.querySelector('circle')!.getAttribute('stroke-width'))
  // "100%" is roughly 2.6 characters wide at this weight; it has to fit inside
  // the arc, not touch it.
  expect(fontSize * 2.6).toBeLessThan(size - 2 * stroke - 6)
})
