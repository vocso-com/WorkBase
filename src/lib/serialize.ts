import type { StoreDoc, Tag, Template, Stage } from '../types'

export const DEFAULT_TAGS: Tag[] = [
  { name: 'High', color: 'red' },
  { name: 'SEO', color: 'blue' },
  { name: 'Revenue', color: 'teal' },
]

export function emptyDocument(): StoreDoc {
  return { version: 1, roots: [], tagPalette: [...DEFAULT_TAGS], templates: [], stages: [] }
}

export function serialize(doc: StoreDoc): string {
  return JSON.stringify(doc, null, 2)
}

export function deserialize(text: string): StoreDoc {
  const parsed = JSON.parse(text)
  if (typeof parsed.version === 'number' && parsed.version > 1) {
    throw new Error('Unsupported data version')
  }
  if (!Array.isArray(parsed.roots)) {
    throw new Error('Invalid data file')
  }
  return {
    version: 1,
    roots: parsed.roots,
    tagPalette: Array.isArray(parsed.tagPalette) ? parsed.tagPalette : [...DEFAULT_TAGS],
    templates: Array.isArray(parsed.templates) ? (parsed.templates as Template[]) : [],
    stages: Array.isArray(parsed.stages) ? (parsed.stages as Stage[]) : [],
    profile: parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : undefined,
  }
}
