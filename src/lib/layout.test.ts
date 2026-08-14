import { layoutTree } from './layout'
import { instantiateTemplate, BUILTIN_TEMPLATES } from './templates'

const project = instantiateTemplate(BUILTIN_TEMPLATES[0], [])

test('layout places the root and every module/task as a node', () => {
  const l = layoutTree(project)
  const moduleCount = project.children.length
  const taskCount = project.children.reduce((a, m) => a + m.children.length, 0)
  expect(l.nodes).toHaveLength(1 + moduleCount + taskCount)
  expect(l.width).toBeGreaterThan(0)
  expect(l.height).toBeGreaterThan(0)
})

test('depth maps to distinct x columns (root < module < task)', () => {
  const l = layoutTree(project)
  const root = l.nodes.find(n => n.id === project.id)!
  const mod = l.nodes.find(n => n.depth === 1)!
  const task = l.nodes.find(n => n.depth === 2)!
  expect(root.x).toBeLessThan(mod.x)
  expect(mod.x).toBeLessThan(task.x)
})

test('an edge connects the root to each module', () => {
  const l = layoutTree(project)
  for (const mod of project.children) {
    expect(l.edges.some(e => e.from === project.id && e.to === mod.id)).toBe(true)
  }
})

test('no node has a negative y after normalization', () => {
  const l = layoutTree(project)
  expect(l.nodes.every(n => n.y >= 0)).toBe(true)
})

test('a childless root yields a single node and no edges', () => {
  const solo = { ...project, children: [] }
  const l = layoutTree(solo)
  expect(l.nodes).toHaveLength(1)
  expect(l.edges).toHaveLength(0)
})
