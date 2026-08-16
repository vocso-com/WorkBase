import { toProjectExport, parseProjectExport, mergeProjectExport } from './json'
import { emptyDocument } from '../serialize'
import { newNode } from '../factory'
import type { Node, StoreDoc } from '../../types'

const AT = '2026-08-16T10:00:00.000Z'

function docWith(...roots: Node[]): StoreDoc {
  const d = emptyDocument()
  d.stages = [
    { id: 'review', label: 'In review', color: 'amber' },
    { id: 'parked', label: 'Parked', color: 'slate' },
  ]
  return { ...d, roots }
}

const sample = () => {
  const task = newNode('Wireframes', { status: 'review', tags: [{ name: 'Design', color: 'violet' }] })
  const mod = newNode('Design', { children: [task] })
  return { task, mod, project: newNode('Rebuild', { shortId: 'RE-1', children: [mod] }) }
}

test('only the stages and tags the subtree references are carried', () => {
  const { project } = sample()
  const exp = toProjectExport(project, docWith(project), AT)
  expect(exp.stages.map(s => s.id)).toEqual(['review'])
  expect(exp.tagPalette.map(t => t.name)).toEqual(['Design'])
})

test('the envelope identifies itself and stamps the given time', () => {
  const { project } = sample()
  const exp = toProjectExport(project, docWith(project), AT)
  expect(exp.kind).toBe('project')
  expect(exp.version).toBe(1)
  expect(exp.exportedAt).toBe(AT)
})

test('a round trip through JSON preserves the project', () => {
  const { project } = sample()
  const exp = toProjectExport(project, docWith(project), AT)
  const back = parseProjectExport(JSON.stringify(exp))
  expect(back.node.title).toBe('Rebuild')
  expect(back.node.children[0].children[0].title).toBe('Wireframes')
})

test('parsing rejects non-JSON, foreign files and future versions', () => {
  expect(() => parseProjectExport('not json')).toThrow(/valid JSON/)
  expect(() => parseProjectExport('{"roots":[]}')).toThrow(/not a WorkBase project export/)
  expect(() => parseProjectExport('{"kind":"project","version":9,"node":{"children":[]}}')).toThrow(/newer version/)
  expect(() => parseProjectExport('{"kind":"project","version":1}')).toThrow(/missing its project/)
})

test('merging appends the project to the active workspace', () => {
  const { project } = sample()
  const exp = toProjectExport(project, docWith(project), AT)
  const target = emptyDocument()
  const merged = mergeProjectExport(target, exp)
  expect(merged.roots).toHaveLength(1)
  expect(merged.roots[0].title).toBe('Rebuild')
  expect(merged.roots[0].workspace).toBe(target.activeWorkspace)
})

test('merging gives every node a fresh id so a double import does not collide', () => {
  const { project } = sample()
  const exp = toProjectExport(project, docWith(project), AT)
  const once = mergeProjectExport(emptyDocument(), exp)
  const twice = mergeProjectExport(once, exp)
  expect(twice.roots).toHaveLength(2)
  expect(twice.roots[0].id).not.toBe(twice.roots[1].id)
  expect(twice.roots[0].children[0].id).not.toBe(twice.roots[1].children[0].id)
})

test('shortIds are re-issued and stay unique across the whole document', () => {
  const { project } = sample()
  const exp = toProjectExport(project, docWith(project), AT)
  const merged = mergeProjectExport(mergeProjectExport(emptyDocument(), exp), exp)
  const ids: string[] = []
  const walk = (n: Node) => { ids.push(n.shortId); n.children.forEach(walk) }
  merged.roots.forEach(walk)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids.every(id => id.startsWith('RE-'))).toBe(true)
})

test('dependencies are remapped onto the new ids', () => {
  const a = newNode('Blocker')
  const b = newNode('Blocked', { dependsOn: [a.id] })
  const project = newNode('Rebuild', { children: [newNode('M', { children: [a, b] })] })
  const exp = toProjectExport(project, docWith(project), AT)
  const merged = mergeProjectExport(emptyDocument(), exp)
  const [newA, newB] = merged.roots[0].children[0].children
  expect(newB.dependsOn).toEqual([newA.id])
  expect(newB.dependsOn).not.toContain(a.id)
})

test('a dependency pointing outside the exported subtree is dropped', () => {
  const orphan = newNode('Elsewhere')
  const b = newNode('Blocked', { dependsOn: [orphan.id] })
  const project = newNode('Rebuild', { children: [newNode('M', { children: [b] })] })
  const exp = toProjectExport(project, docWith(project), AT)
  const merged = mergeProjectExport(emptyDocument(), exp)
  expect(merged.roots[0].children[0].children[0].dependsOn).toEqual([])
})

test('missing stages and tags are added, existing ones are left alone', () => {
  const { project } = sample()
  const exp = toProjectExport(project, docWith(project), AT)
  const target = emptyDocument()
  target.stages = [{ id: 'review', label: 'LOCAL NAME', color: 'red' }]
  const merged = mergeProjectExport(target, exp)
  // The local definition wins — it is the one the user has been looking at.
  expect(merged.stages.filter(s => s.id === 'review')).toHaveLength(1)
  expect(merged.stages.find(s => s.id === 'review')!.label).toBe('LOCAL NAME')
  expect(merged.tagPalette.filter(t => t.name === 'Design')).toHaveLength(1)
})

test('merging does not mutate the document it was given', () => {
  const { project } = sample()
  const exp = toProjectExport(project, docWith(project), AT)
  const target = emptyDocument()
  mergeProjectExport(target, exp)
  expect(target.roots).toHaveLength(0)
})
