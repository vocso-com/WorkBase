import { webAdapter } from './storage'
import { emptyDocument } from './serialize'

beforeEach(() => localStorage.clear())

test('load returns empty document when nothing stored', async () => {
  expect(await webAdapter.load()).toEqual(emptyDocument())
})

test('save then load round-trips', async () => {
  const doc = emptyDocument()
  doc.roots.push({ id: 'p', shortId: 'P-1', title: 'Proj', status: 'todo', children: [], createdAt: '', updatedAt: '' })
  await webAdapter.save(doc)
  expect(await webAdapter.load()).toEqual(doc)
})
