import { emptyDocument, serialize, deserialize } from './serialize'

test('empty document is version 1 with empty roots', () => {
  const d = emptyDocument()
  expect(d.version).toBe(1)
  expect(d.roots).toEqual([])
  expect(Array.isArray(d.tagPalette)).toBe(true)
})

test('serialize/deserialize round-trips', () => {
  const d = emptyDocument()
  expect(deserialize(serialize(d))).toEqual(d)
})

test('rejects future versions', () => {
  expect(() => deserialize(JSON.stringify({ version: 2, roots: [], tagPalette: [] })))
    .toThrow('Unsupported data version')
})

test('rejects malformed shape', () => {
  expect(() => deserialize(JSON.stringify({ version: 1 }))).toThrow('Invalid data file')
})
