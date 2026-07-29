import { sampleDoc } from './seed'

test('sample doc has the four notebook projects', () => {
  const d = sampleDoc()
  expect(d.roots.map(r => r.title)).toEqual(['Streamline', 'SampleRoom', 'Clearwater', 'ProjectGrid'])
  expect(d.roots.every(r => r.shortId.length > 0)).toBe(true)
  expect(d.roots[0].children.length).toBeGreaterThan(0)
})
