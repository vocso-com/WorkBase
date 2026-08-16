import { projectToCsv, csvToProjects, encodeCsv, decodeCsv } from './csv'
import { newNode } from '../factory'

const sample = () => {
  const deep = newNode('Sub task', { shortId: 'RE-4', status: 'done' })
  const task = newNode('Wireframes', { shortId: 'RE-3', dueDate: '2026-09-01', priority: 'high', children: [deep] })
  const emptyMod = newNode('Empty phase', { shortId: 'RE-5' })
  const mod = newNode('Design', { shortId: 'RE-2', children: [task] })
  return newNode('Rebuild', { shortId: 'RE-1', children: [mod, emptyMod] })
}

test('quotes only the fields that need it, and doubles inner quotes', () => {
  expect(encodeCsv([['a', 'b,c', 'say "hi"', 'two\nlines']]))
    .toBe('a,"b,c","say ""hi""","two\nlines"\r\n')
})

test('reads back quoted fields containing commas, quotes and newlines', () => {
  const rows = decodeCsv('a,"b,c","say ""hi""","two\nlines"\r\nx,y,z,w\r\n')
  expect(rows[0]).toEqual(['a', 'b,c', 'say "hi"', 'two\nlines'])
  expect(rows[1]).toEqual(['x', 'y', 'z', 'w'])
})

test('a leading BOM does not corrupt the first header', () => {
  expect(decodeCsv('﻿shortId,title\r\nRE-1,Rebuild\r\n')[0][0]).toBe('shortId')
})

test('every node gets a row, containers included', () => {
  const rows = decodeCsv(projectToCsv(sample()))
  expect(rows[0]).toContain('parentShortId')
  // header + 5 nodes
  expect(rows).toHaveLength(6)
  expect(rows.map(r => r[4])).toContain('Empty phase')
})

test('a round trip rebuilds the tree exactly', () => {
  const [back] = csvToProjects(projectToCsv(sample()))
  expect(back.title).toBe('Rebuild')
  expect(back.children.map(c => c.title)).toEqual(['Design', 'Empty phase'])
  const task = back.children[0].children[0]
  expect(task.title).toBe('Wireframes')
  expect(task.dueDate).toBe('2026-09-01')
  expect(task.priority).toBe('high')
  expect(task.children[0].title).toBe('Sub task')
  expect(task.children[0].status).toBe('done')
})

test('nesting deeper than three levels survives', () => {
  const l4 = newNode('L4', { shortId: 'D-4' })
  const l3 = newNode('L3', { shortId: 'D-3', children: [l4] })
  const l2 = newNode('L2', { shortId: 'D-2', children: [l3] })
  const root = newNode('L1', { shortId: 'D-1', children: [l2] })
  const [back] = csvToProjects(projectToCsv(root))
  expect(back.children[0].children[0].children[0].title).toBe('L4')
})

test('tags round trip and descriptions are flattened to text', () => {
  const t = newNode('T', { shortId: 'A-2', tags: [{ name: 'Design', color: 'violet' }, { name: 'SEO', color: 'cyan' }],
    description: '<p>Some <b>rich</b> note</p>' })
  const root = newNode('P', { shortId: 'A-1', children: [t] })
  const csv = projectToCsv(root)
  expect(csv).toContain('Design; SEO')
  const [back] = csvToProjects(csv)
  expect(back.children[0].tags!.map(x => x.name)).toEqual(['Design', 'SEO'])
  expect(back.children[0].description).toBe('Some rich note')
})

test('dependencies are remapped onto the rebuilt nodes', () => {
  const a = newNode('Blocker', { shortId: 'P-2' })
  const b = newNode('Blocked', { shortId: 'P-3' })
  b.dependsOn = [a.id]
  // Exported as shortIds, so fix up the fixture the way the exporter would.
  const root = newNode('P', { shortId: 'P-1', children: [a, b] })
  const csv = projectToCsv(root).replace(a.id, 'P-2')
  const [back] = csvToProjects(csv)
  const [newA, newB] = back.children
  expect(newB.dependsOn).toEqual([newA.id])
})

test('a dependency pointing outside the file is dropped', () => {
  const b = newNode('Blocked', { shortId: 'Q-2' })
  b.dependsOn = ['not-in-file']
  const root = newNode('Q', { shortId: 'Q-1', children: [b] })
  const [back] = csvToProjects(projectToCsv(root))
  expect(back.children[0].dependsOn).toBeUndefined()
})

test('several level-0 rows import as several projects', () => {
  const csv = encodeCsv([
    ['shortId', 'parentShortId', 'title'],
    ['A-1', '', 'First'],
    ['A-2', 'A-1', 'Child'],
    ['B-1', '', 'Second'],
  ])
  const projects = csvToProjects(csv)
  expect(projects.map(p => p.title)).toEqual(['First', 'Second'])
  expect(projects[0].children[0].title).toBe('Child')
})

test('a wrong-shaped CSV says exactly what is missing', () => {
  expect(() => csvToProjects('')).toThrow(/empty/i)
  expect(() => csvToProjects('name,owner\r\nx,y\r\n')).toThrow(/title/i)
  expect(() => csvToProjects('title\r\nJust a title\r\n')).toThrow(/shortId.*parentShortId/i)
  expect(() => csvToProjects(encodeCsv([['shortId', 'parentShortId', 'title']]))).toThrow(/no rows/i)
})
