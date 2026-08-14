import { BUILTIN_TEMPLATES, instantiateTemplate, projectToTemplate } from './templates'
import { newNode } from './factory'

const tpl = BUILTIN_TEMPLATES[0]

test('every builtin template has a unique id and at least one module', () => {
  const ids = new Set(BUILTIN_TEMPLATES.map(t => t.id))
  expect(ids.size).toBe(BUILTIN_TEMPLATES.length)
  for (const t of BUILTIN_TEMPLATES) {
    expect(t.modules.length).toBeGreaterThan(0)
    expect(t.builtin).toBe(true)
  }
})

test('instantiateTemplate builds a project with modules and tasks', () => {
  const root = instantiateTemplate(tpl, [])
  expect(root.title).toBe(tpl.name)
  expect(root.children).toHaveLength(tpl.modules.length)
  const firstMod = root.children[0]
  expect(firstMod.children).toHaveLength(tpl.modules[0].items.length)
  expect(firstMod.children[0].title).toBe(tpl.modules[0].items[0].title)
})

test('instantiateTemplate assigns fresh, unique ids and shortIds', () => {
  const root = instantiateTemplate(tpl, [])
  const ids: string[] = []
  const shortIds: string[] = []
  const walk = (n: typeof root) => {
    ids.push(n.id)
    shortIds.push(n.shortId)
    n.children.forEach(walk)
  }
  walk(root)
  expect(new Set(ids).size).toBe(ids.length)
  expect(new Set(shortIds).size).toBe(shortIds.length)
  expect(shortIds.every(s => /^[A-Z]{1,2}-\d+$/.test(s))).toBe(true)
})

test('instantiateTemplate does not collide shortIds with existing roots', () => {
  const existing = newNode('Mobile App', { color: 'violet' })
  existing.shortId = 'MA-1'
  const root = instantiateTemplate(tpl, [existing], 'Mobile App')
  const shortIds: string[] = []
  const walk = (n: typeof root) => { shortIds.push(n.shortId); n.children.forEach(walk) }
  walk(root)
  expect(shortIds).not.toContain('MA-1')
})

test('applying the same template twice yields independent trees', () => {
  const a = instantiateTemplate(tpl, [])
  const b = instantiateTemplate(tpl, [a])
  expect(a.id).not.toBe(b.id)
  a.children[0].title = 'changed'
  expect(b.children[0].title).not.toBe('changed')
})

test('projectToTemplate captures structure without ids', () => {
  const root = instantiateTemplate(tpl, [])
  const captured = projectToTemplate(root, 'custom-1')
  expect(captured.id).toBe('custom-1')
  expect(captured.builtin).toBe(false)
  expect(captured.name).toBe(root.title)
  expect(captured.modules).toHaveLength(root.children.length)
  expect(JSON.stringify(captured)).not.toContain(root.id)
  // round-trip: rebuild from the captured template
  const rebuilt = instantiateTemplate({ ...captured, name: 'Rebuilt' }, [])
  expect(rebuilt.children).toHaveLength(root.children.length)
})
