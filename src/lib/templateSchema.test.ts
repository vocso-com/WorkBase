import { validateTemplate, findDuplicateIds } from '../../scripts/template-schema.mjs'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ok = () => ({
  id: 'tpl-thing', name: 'Thing', description: 'Does a thing', icon: 'ti-rocket',
  color: 'teal', category: 'agency', tier: 'free',
  modules: [{ name: 'Phase', items: [{ title: 'Do it' }] }],
})

test('a well-formed template passes', () => {
  expect(validateTemplate(ok())).toEqual([])
})

test('every required field is named when missing', () => {
  const errs = validateTemplate({ modules: [] })
  expect(errs.join(' ')).toMatch(/id/)
  expect(errs.join(' ')).toMatch(/name/)
  expect(errs.join(' ')).toMatch(/description/)
  expect(errs.join(' ')).toMatch(/icon/)
})

test('ids must be url-safe so they can key the directory', () => {
  expect(validateTemplate({ ...ok(), id: 'Not Valid' }).join(' ')).toMatch(/lowercase/)
  expect(validateTemplate({ ...ok(), id: 'tpl-ok-2' })).toEqual([])
})

test('unknown colours, tiers, statuses and priorities are caught', () => {
  expect(validateTemplate({ ...ok(), color: 'chartreuse' }).join(' ')).toMatch(/color/)
  expect(validateTemplate({ ...ok(), tier: 'enterprise' }).join(' ')).toMatch(/tier/)
  const badItem = { ...ok(), modules: [{ name: 'P', items: [{ title: 'x', status: 'wip', priority: 'urgent' }] }] }
  const errs = validateTemplate(badItem).join(' ')
  expect(errs).toMatch(/status/)
  expect(errs).toMatch(/priority/)
})

test('icons must be Tabler names', () => {
  expect(validateTemplate({ ...ok(), icon: 'rocket' }).join(' ')).toMatch(/ti-/)
})

test('a template with no modules seeds nothing and is rejected', () => {
  expect(validateTemplate({ ...ok(), modules: [] }).join(' ')).toMatch(/empty/)
})

test('errors point at the exact module and item', () => {
  const t = { ...ok(), modules: [{ name: 'P', items: [{ title: 'fine' }, { }] }] }
  expect(validateTemplate(t).join(' ')).toMatch(/modules\[0\]\.items\[1\]\.title/)
})

test('duplicate ids across files are reported with both files', () => {
  const dupes = findDuplicateIds([
    { id: 'a', file: 'one.json' }, { id: 'b', file: 'two.json' }, { id: 'a', file: 'three.json' },
  ])
  expect(dupes).toHaveLength(1)
  expect(dupes[0].files).toEqual(['one.json', 'three.json'])
})

// The catalogue that actually ships has to stay publishable.
function allTemplateFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return allTemplateFiles(full)
    return name.endsWith('.json') ? [full] : []
  })
}

test('every template in templates/ is valid and uniquely identified', () => {
  const files = allTemplateFiles('templates')
  expect(files.length).toBeGreaterThan(0)
  const loaded = files.map(file => ({ file, json: JSON.parse(readFileSync(file, 'utf8')) }))
  for (const { file, json } of loaded) {
    expect({ file, errors: validateTemplate(json) }).toEqual({ file, errors: [] })
  }
  expect(findDuplicateIds(loaded.map(l => ({ id: l.json.id, file: l.file })))).toEqual([])
})
