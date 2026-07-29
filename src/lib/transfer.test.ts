import { parseImport } from './transfer'
import { emptyDocument, serialize } from './serialize'

test('parseImport accepts a valid document', () => {
  const doc = emptyDocument()
  expect(parseImport(serialize(doc))).toEqual(doc)
})

test('parseImport throws on future version', () => {
  expect(() => parseImport(JSON.stringify({ version: 3, roots: [] }))).toThrow('Unsupported data version')
})
