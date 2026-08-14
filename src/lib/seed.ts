import type { StoreDoc, Node, ColorKey, Status, Tag } from '../types'
import { newNode } from './factory'
import { DEFAULT_TAGS, defaultWorkspaces, DEFAULT_WORKSPACE_ID } from './serialize'
import { projectPrefix, nextShortId } from './shortid'

interface ItemSeed {
  title: string
  status: Status
  tags?: Tag[]
}

interface ModuleSeed {
  name: string
  color: ColorKey
  icon: string
  items: ItemSeed[]
}

interface ProjectSeed {
  name: string
  desc: string
  color: ColorKey
  icon: string
  status: Status
  tags?: Tag[]
  modules: ModuleSeed[]
}

const tag = (name: string, color: ColorKey): Tag => ({ name, color })

const PROJECTS: ProjectSeed[] = [
  {
    name: 'Streamline',
    desc: 'Publish, test, onboard',
    color: 'violet',
    icon: 'ti-broadcast',
    status: 'doing',
    tags: [tag('Launch', 'violet')],
    modules: [
      {
        name: 'Publish',
        color: 'violet',
        icon: 'ti-rocket',
        items: [
          { title: 'Publish flow', status: 'done', tags: [tag('Ship', 'teal')] },
          { title: 'Test', status: 'done' },
          { title: 'User influence', status: 'doing', tags: [tag('Growth', 'amber')] },
        ],
      },
      {
        name: 'Onboarding',
        color: 'violet',
        icon: 'ti-user-plus',
        items: [
          { title: 'Welcome screen', status: 'done' },
          { title: 'Steps', status: 'doing' },
        ],
      },
      {
        name: 'Influence',
        color: 'violet',
        icon: 'ti-trending-up',
        items: [
          { title: 'Metrics', status: 'todo', tags: [tag('Data', 'blue')] },
          { title: 'Reach', status: 'todo' },
        ],
      },
    ],
  },
  {
    name: 'SampleRoom',
    desc: 'Testing, payments, SEO',
    color: 'teal',
    icon: 'ti-building-store',
    status: 'doing',
    tags: [tag('Revenue', 'teal'), tag('SEO', 'blue')],
    modules: [
      {
        name: 'Testing',
        color: 'teal',
        icon: 'ti-test-pipe',
        items: [
          { title: 'SMTP', status: 'done' },
          { title: 'Email setup', status: 'doing', tags: [tag('Infra', 'blue')] },
          { title: 'Sitemap / indexing', status: 'todo', tags: [tag('SEO', 'blue')] },
        ],
      },
      {
        name: 'Payment gateway',
        color: 'coral',
        icon: 'ti-credit-card',
        items: [
          { title: 'Error handling', status: 'blocked', tags: [tag('High', 'red')] },
          { title: 'FB / Google Ads', status: 'todo', tags: [tag('Ads', 'amber')] },
        ],
      },
      {
        name: 'Site content',
        color: 'teal',
        icon: 'ti-layout-grid',
        items: [
          { title: 'SEO content', status: 'done' },
          { title: 'Security fee', status: 'done' },
          { title: 'Campaign errors', status: 'todo' },
        ],
      },
    ],
  },
  {
    name: 'Clearwater',
    desc: 'Content, Rome affiliates',
    color: 'blue',
    icon: 'ti-cloud',
    status: 'todo',
    tags: [tag('Content', 'blue')],
    modules: [
      {
        name: 'Content & issues',
        color: 'blue',
        icon: 'ti-file-text',
        items: [
          { title: 'Rome affiliates', status: 'done' },
          { title: 'Content fixes', status: 'todo' },
          { title: 'Confluence', status: 'todo' },
        ],
      },
      {
        name: 'Downloads',
        color: 'blue',
        icon: 'ti-download',
        items: [
          { title: 'Calls / wallet', status: 'doing' },
          { title: 'Pamphlets', status: 'todo' },
          { title: 'Directory submission', status: 'todo', tags: [tag('SEO', 'blue')] },
        ],
      },
    ],
  },
  {
    name: 'ProjectGrid',
    desc: 'Org chart, demos, submit',
    color: 'coral',
    icon: 'ti-users',
    status: 'blocked',
    tags: [tag('Blocked', 'red')],
    modules: [
      {
        name: 'Key demos',
        color: 'coral',
        icon: 'ti-presentation',
        items: [
          { title: 'Competitors', status: 'done' },
          { title: 'Enhancements', status: 'blocked', tags: [tag('High', 'red')] },
          { title: 'Submit flow', status: 'todo' },
          { title: 'Onboarding', status: 'todo' },
        ],
      },
      {
        name: 'Directory',
        color: 'coral',
        icon: 'ti-sitemap',
        items: [
          { title: 'Directory entry', status: 'done' },
          { title: 'Reports view', status: 'todo' },
        ],
      },
    ],
  },
]

export function sampleDoc(): StoreDoc {
  const roots: Node[] = []

  for (const proj of PROJECTS) {
    const prefix = projectPrefix(proj.name)
    const root = newNode(proj.name, {
      color: proj.color,
      icon: proj.icon,
      status: proj.status,
      description: proj.desc,
      tags: proj.tags,
    })
    root.shortId = nextShortId(roots, prefix)
    roots.push(root)

    for (const mod of proj.modules) {
      const modNode = newNode(mod.name, { color: mod.color, icon: mod.icon, status: 'todo' })
      modNode.shortId = nextShortId(roots, prefix)
      root.children.push(modNode)

      for (const item of mod.items) {
        const itemNode = newNode(item.title, {
          status: item.status,
          color: mod.color,
          tags: item.tags,
        })
        itemNode.shortId = nextShortId(roots, prefix)
        modNode.children.push(itemNode)
      }
    }
  }

  return { version: 1, roots, workspaces: defaultWorkspaces(), activeWorkspace: DEFAULT_WORKSPACE_ID, tagPalette: [...DEFAULT_TAGS], templates: [], stages: [] }
}
