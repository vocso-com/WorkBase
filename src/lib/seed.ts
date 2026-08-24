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

// A neutral, fictional first-run demo. Statuses are deliberately mixed so the
// computed rollup, health and staleness all have something to show on launch
// rather than a board that is uniformly empty or uniformly done.
const PROJECTS: ProjectSeed[] = [
  {
    name: 'Acme Website',
    desc: 'Design, build, launch',
    color: 'violet',
    icon: 'ti-rocket',
    status: 'doing',
    tags: [tag('Client Review', 'amber')],
    modules: [
      {
        name: 'Discovery',
        color: 'violet',
        icon: 'ti-users',
        items: [
          { title: 'Kickoff call', status: 'done' },
          { title: 'Content inventory', status: 'done', tags: [tag('Content', 'teal')] },
          { title: 'Sitemap sign-off', status: 'doing', tags: [tag('Client Review', 'amber')] },
        ],
      },
      {
        name: 'Design',
        color: 'violet',
        icon: 'ti-layout-grid',
        items: [
          { title: 'Homepage concept', status: 'done', tags: [tag('Design', 'violet')] },
          { title: 'Interior pages', status: 'doing', tags: [tag('Design', 'violet')] },
          { title: 'Mobile layouts', status: 'todo' },
        ],
      },
      {
        name: 'Build',
        color: 'violet',
        icon: 'ti-file-text',
        items: [
          { title: 'Component library', status: 'doing', tags: [tag('Development', 'blue')] },
          { title: 'CMS integration', status: 'todo', tags: [tag('Development', 'blue')] },
          { title: 'Launch checklist', status: 'todo' },
        ],
      },
    ],
  },
  {
    name: 'Mobile App v2',
    desc: 'Onboarding, payments, QA',
    color: 'teal',
    icon: 'ti-download',
    status: 'doing',
    modules: [
      {
        name: 'Onboarding',
        color: 'teal',
        icon: 'ti-user-plus',
        items: [
          { title: 'Welcome screens', status: 'done' },
          { title: 'Account setup', status: 'doing' },
        ],
      },
      {
        name: 'Payments',
        color: 'teal',
        icon: 'ti-credit-card',
        items: [
          { title: 'Provider integration', status: 'doing', tags: [tag('Development', 'blue')] },
          { title: 'Receipts', status: 'todo' },
          { title: 'Refund flow', status: 'todo', tags: [tag('Urgent', 'red')] },
        ],
      },
      {
        name: 'QA',
        color: 'teal',
        icon: 'ti-test-pipe',
        items: [
          { title: 'Device matrix', status: 'todo' },
          { title: 'Release candidate', status: 'todo' },
        ],
      },
    ],
  },
  {
    name: 'Brand Refresh',
    desc: 'Identity, assets, rollout',
    color: 'amber',
    icon: 'ti-presentation',
    status: 'doing',
    tags: [tag('Design', 'violet')],
    modules: [
      {
        name: 'Identity',
        color: 'amber',
        icon: 'ti-trending-up',
        items: [
          { title: 'Logo directions', status: 'done', tags: [tag('Design', 'violet')] },
          { title: 'Colour and type', status: 'doing', tags: [tag('Design', 'violet')] },
        ],
      },
      {
        name: 'Rollout',
        color: 'amber',
        icon: 'ti-broadcast',
        items: [
          { title: 'Templates', status: 'todo' },
          { title: 'Guidelines doc', status: 'todo', tags: [tag('Content', 'teal')] },
        ],
      },
    ],
  },
  {
    name: 'Team Handbook',
    desc: 'Structure, docs, rollout',
    color: 'coral',
    icon: 'ti-sitemap',
    status: 'todo',
    modules: [
      {
        name: 'Structure',
        color: 'coral',
        icon: 'ti-building-store',
        items: [
          { title: 'Team directory', status: 'done' },
          { title: 'Role descriptions', status: 'todo' },
        ],
      },
      {
        name: 'Docs',
        color: 'coral',
        icon: 'ti-cloud',
        items: [
          { title: 'Onboarding guide', status: 'todo', tags: [tag('Content', 'teal')] },
          { title: 'Policy pages', status: 'todo' },
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
