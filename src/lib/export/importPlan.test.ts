import { parseImportFile, planImport, applyImport } from './importPlan'
import { toProjectExport } from './json'
import { projectToCsv } from './csv'
import { emptyDocument } from '../serialize'
import { newNode } from '../factory'
import type { Node, StoreDoc } from '../../types'

const AT = '2026-08-16T10:00:00.000Z'
const project = (title = 'Rebuild') =>
  newNode(title, { shortId: 'RE-1', children: [newNode('Design', { shortId: 'RE-2', children: [newNode('Wireframes', { shortId: 'RE-3' })] })] })

const docWith = (...roots: Node[]): StoreDoc => ({ ...emptyDocument(), roots })

// ── Format sniffing ──────────────────────────────────────────────────────────

test('recognises a single-project export', () => {
  const p = project()
  const parsed = parseImportFile(JSON.stringify(toProjectExport(p, docWith(p), AT)))
  expect(parsed.format).toBe('project')
  expect(parsed.projects).toHaveLength(1)
})

test('recognises an account backup and finds every project in it', () => {
  const doc = docWith(project('One'), project('Two'))
  const parsed = parseImportFile(JSON.stringify(doc))
  expect(parsed.format).toBe('backup')
  expect(parsed.projects.map(p => p.node.title)).toEqual(['One', 'Two'])
})

test('recognises a CSV by its content, not its extension', () => {
  const parsed = parseImportFile(projectToCsv(project()))
  expect(parsed.format).toBe('csv')
  expect(parsed.projects[0].node.title).toBe('Rebuild')
})

test('an unusable file says what was expected', () => {
  expect(() => parseImportFile('   ')).toThrow(/empty/i)
  expect(() => parseImportFile('{ "nope": true }')).toThrow(/not a WorkBase project or account backup/i)
  expect(() => parseImportFile('{ "roots": [] }')).toThrow(/no projects/i)
  expect(() => parseImportFile('{ "roots": [')).toThrow(/could not be read/i)
})

// ── Collision detection ──────────────────────────────────────────────────────

test('a project that is not here yet has no collision', () => {
  const parsed = parseImportFile(JSON.stringify(toProjectExport(project(), docWith(), AT)))
  const [c] = planImport(emptyDocument(), parsed)
  expect(c.existingId).toBeUndefined()
  expect(c.tasks).toBe(1)
  expect(c.modules).toBe(1)
})

test('the same project re-exported from this document matches on id', () => {
  const p = project()
  const doc = docWith(p)
  const parsed = parseImportFile(JSON.stringify(toProjectExport(p, doc, AT)))
  expect(planImport(doc, parsed)[0].existingId).toBe(p.id)
})

test('a project with the same name matches on title, ignoring case and spacing', () => {
  const mine = project('Website Rebuild')
  const theirs = project('  website rebuild ')
  const parsed = parseImportFile(JSON.stringify(toProjectExport(theirs, docWith(theirs), AT)))
  expect(planImport(docWith(mine), parsed)[0].existingId).toBe(mine.id)
})

test('a collision never pre-selects a destructive resolution', () => {
  const mine = project()
  const parsed = parseImportFile(JSON.stringify(toProjectExport(project(), docWith(mine), AT)))
  expect(planImport(docWith(mine), parsed)[0].resolution).toBe('add')
})

// ── Applying decisions ───────────────────────────────────────────────────────

const parsedOf = (n: Node) => parseImportFile(JSON.stringify(toProjectExport(n, docWith(n), AT)))

test('add appends a copy and leaves the original alone', () => {
  const mine = project()
  const doc = docWith(mine)
  const parsed = parsedOf(project())
  const plan = planImport(doc, parsed)
  const out = applyImport(doc, parsed, plan)
  expect(out.added).toBe(1)
  expect(out.doc.roots).toHaveLength(2)
  expect(out.doc.roots[0].id).toBe(mine.id)
  expect(out.doc.roots[1].id).not.toBe(mine.id)
})

test('update replaces the content but keeps the project identity', () => {
  const mine = project()
  const doc = docWith(mine)
  const incoming = project()
  incoming.children.push(newNode('Extra phase', { shortId: 'RE-9' }))
  const parsed = parsedOf(incoming)
  const plan = planImport(doc, parsed).map(c => ({ ...c, resolution: 'update' as const }))
  const out = applyImport(doc, parsed, plan)
  expect(out.updated).toBe(1)
  expect(out.doc.roots).toHaveLength(1)
  // Same project as far as tabs and links are concerned…
  expect(out.doc.roots[0].id).toBe(mine.id)
  // …with the incoming content.
  expect(out.doc.roots[0].children.map(c => c.title)).toEqual(['Design', 'Extra phase'])
})

test('ignore changes nothing', () => {
  const mine = project()
  const doc = docWith(mine)
  const parsed = parsedOf(project())
  const plan = planImport(doc, parsed).map(c => ({ ...c, resolution: 'ignore' as const }))
  const out = applyImport(doc, parsed, plan)
  expect(out.ignored).toBe(1)
  expect(out.doc.roots).toHaveLength(1)
  expect(out.doc.roots[0]).toBe(mine)
})

test('an unselected project is skipped entirely', () => {
  const doc = docWith()
  const parsed = parseImportFile(JSON.stringify(docWith(project('One'), project('Two'))))
  const plan = planImport(doc, parsed).map((c, i) => ({ ...c, selected: i === 0 }))
  const out = applyImport(doc, parsed, plan)
  expect(out.doc.roots.map(r => r.title)).toEqual(['One'])
})

test('shortIds stay unique across the document after an add', () => {
  const mine = project()
  const doc = docWith(mine)
  const parsed = parsedOf(project())
  const out = applyImport(doc, parsed, planImport(doc, parsed))
  const ids: string[] = []
  const walk = (n: Node) => { ids.push(n.shortId); n.children.forEach(walk) }
  out.doc.roots.forEach(walk)
  expect(new Set(ids).size).toBe(ids.length)
})

test('stages and tags are added but never overwrite the local definition', () => {
  const doc: StoreDoc = { ...emptyDocument(), stages: [{ id: 'review', label: 'LOCAL', color: 'red' }] }
  const p = newNode('P', { shortId: 'P-1', children: [newNode('T', { shortId: 'P-2', status: 'review' })] })
  const src: StoreDoc = { ...emptyDocument(), stages: [{ id: 'review', label: 'THEIRS', color: 'blue' }], roots: [p] }
  const parsed = parseImportFile(JSON.stringify(toProjectExport(p, src, AT)))
  const out = applyImport(doc, parsed, planImport(doc, parsed))
  expect(out.doc.stages.filter(s => s.id === 'review')).toHaveLength(1)
  expect(out.doc.stages.find(s => s.id === 'review')!.label).toBe('LOCAL')
})

test('applying does not mutate the document it was given', () => {
  const doc = docWith()
  const parsed = parsedOf(project())
  applyImport(doc, parsed, planImport(doc, parsed))
  expect(doc.roots).toHaveLength(0)
})
