import { projectToMarkdown } from './markdown'
import { newNode } from '../factory'
import type { Node } from '../../types'

const project = (...children: Node[]) => newNode('Website Rebuild', { shortId: 'WB-1', children })

test('the project is an H1 with its shortId', () => {
  const md = projectToMarkdown(project())
  expect(md).toContain('# Website Rebuild')
  expect(md).toContain('`WB-1`')
})

test('a module becomes an H2 and its tasks become checkboxes', () => {
  const mod = newNode('Design', { children: [newNode('Wireframes'), newNode('Visuals', { status: 'done' })] })
  const md = projectToMarkdown(project(mod))
  expect(md).toContain('## Design')
  expect(md).toContain('- [ ] Wireframes')
  expect(md).toContain('- [x] Visuals')
})

test('a childless node under the project is a task, not a module', () => {
  const md = projectToMarkdown(project(newNode('Standalone')))
  expect(md).toContain('- [ ] Standalone')
  expect(md).not.toContain('## Standalone')
})

test('nested tasks indent by two spaces per level', () => {
  const sub = newNode('Sub task')
  const task = newNode('Parent task', { children: [sub] })
  const mod = newNode('Build', { children: [task] })
  const md = projectToMarkdown(project(mod))
  expect(md).toContain('- [ ] Parent task')
  expect(md).toContain('  - [ ] Sub task')
})

test('due date, priority and tags ride along as a metadata suffix', () => {
  const t = newNode('Ship', { dueDate: '2026-09-01', priority: 'high', tags: [{ name: 'Billable', color: 'lime' }] })
  const md = projectToMarkdown(project(newNode('M', { children: [t] })))
  expect(md).toMatch(/- \[ \] Ship {2}_\(.*due 2026-09-01.*\)_/)
  expect(md).toContain('priority: high')
  expect(md).toContain('#Billable')
})

test('descriptions become blockquotes indented to their task', () => {
  const t = newNode('Ship', { description: 'Two words.' })
  const md = projectToMarkdown(project(newNode('M', { children: [t] })))
  expect(md).toContain('  > Two words.')
})

test('a multi-line description quotes every line', () => {
  const t = newNode('Ship', { description: 'First line\nSecond line' })
  const md = projectToMarkdown(project(newNode('M', { children: [t] })))
  expect(md).toContain('  > First line')
  expect(md).toContain('  > Second line')
})

test('custom stage labels are used for the stage name', () => {
  const t = newNode('Ship', { status: 'doing' })
  const md = projectToMarkdown(project(newNode('M', { children: [t] })), [], { doing: 'In flight' })
  expect(md).toContain('In flight')
})

test('output is deterministic and ends with exactly one newline', () => {
  const mod = newNode('Design', { children: [newNode('Wireframes')] })
  const a = projectToMarkdown(project(mod))
  const b = projectToMarkdown(project(mod))
  expect(a).toBe(b)
  expect(a.endsWith('\n')).toBe(true)
  expect(a.endsWith('\n\n')).toBe(false)
})

test('an empty project still produces a valid heading', () => {
  expect(projectToMarkdown(project()).trim()).toBe('# Website Rebuild\n`WB-1`')
})
