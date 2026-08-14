import type { Node, Template, Tag, ColorKey } from '../types'
import { newNode } from './factory'
import { projectPrefix, nextShortId } from './shortid'

const tag = (name: string, color: ColorKey): Tag => ({ name, color })

/**
 * Curated templates shipped with the app. Each seeds a project with modules and
 * starter tasks. `id` is stable so it can be referenced in the gallery.
 */
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'tpl-mobile-app',
    name: 'Mobile App',
    description: 'From concept to App Store launch',
    color: 'violet',
    icon: 'ti-device-mobile',
    builtin: true,
    tags: [tag('Mobile', 'violet')],
    modules: [
      {
        name: 'Discovery',
        icon: 'ti-bulb',
        color: 'violet',
        items: [
          { title: 'Define the core problem', status: 'todo' },
          { title: 'Competitor teardown', status: 'todo' },
          { title: 'User personas & journeys', status: 'todo' },
          { title: 'Feature list & MVP scope', status: 'todo', tags: [tag('Scope', 'blue')] },
        ],
      },
      {
        name: 'Design',
        icon: 'ti-palette',
        color: 'coral',
        items: [
          { title: 'Wireframes', status: 'todo' },
          { title: 'Design system & tokens', status: 'todo' },
          { title: 'High-fidelity screens', status: 'todo' },
          { title: 'Prototype & usability test', status: 'todo' },
        ],
      },
      {
        name: 'Build',
        icon: 'ti-code',
        color: 'blue',
        items: [
          { title: 'Project setup & CI', status: 'todo' },
          { title: 'Navigation & auth', status: 'todo', tags: [tag('High', 'red')] },
          { title: 'Core screens', status: 'todo' },
          { title: 'API integration', status: 'todo' },
          { title: 'Offline & error states', status: 'todo' },
        ],
      },
      {
        name: 'Test',
        icon: 'ti-test-pipe',
        color: 'amber',
        items: [
          { title: 'Unit & integration tests', status: 'todo' },
          { title: 'Device / OS matrix QA', status: 'todo' },
          { title: 'Beta via TestFlight / Play', status: 'todo' },
        ],
      },
      {
        name: 'Launch',
        icon: 'ti-rocket',
        color: 'teal',
        items: [
          { title: 'Store listing & screenshots', status: 'todo' },
          { title: 'App Store review submission', status: 'todo', tags: [tag('High', 'red')] },
          { title: 'Analytics & crash reporting', status: 'todo' },
          { title: 'Launch announcement', status: 'todo' },
        ],
      },
    ],
  },
  {
    id: 'tpl-saas-product',
    name: 'SaaS Product',
    description: 'Start to launch: build, bill, grow',
    color: 'blue',
    icon: 'ti-cloud',
    builtin: true,
    tags: [tag('SaaS', 'blue')],
    modules: [
      {
        name: 'Foundations',
        icon: 'ti-building-skyscraper',
        color: 'blue',
        items: [
          { title: 'Positioning & pricing', status: 'todo' },
          { title: 'Landing page', status: 'todo' },
          { title: 'Tech stack & infra', status: 'todo' },
        ],
      },
      {
        name: 'Auth & Accounts',
        icon: 'ti-user-shield',
        color: 'violet',
        items: [
          { title: 'Sign up / sign in', status: 'todo', tags: [tag('High', 'red')] },
          { title: 'Team & roles', status: 'todo' },
          { title: 'Account settings', status: 'todo' },
        ],
      },
      {
        name: 'Core Product',
        icon: 'ti-stack-2',
        color: 'teal',
        items: [
          { title: 'Primary workflow', status: 'todo', tags: [tag('High', 'red')] },
          { title: 'Dashboard', status: 'todo' },
          { title: 'Onboarding flow', status: 'todo' },
        ],
      },
      {
        name: 'Billing',
        icon: 'ti-credit-card',
        color: 'coral',
        items: [
          { title: 'Payment gateway integration', status: 'todo' },
          { title: 'Plans & subscriptions', status: 'todo' },
          { title: 'Invoices & webhooks', status: 'todo' },
        ],
      },
      {
        name: 'Growth',
        icon: 'ti-trending-up',
        color: 'amber',
        items: [
          { title: 'Analytics & funnels', status: 'todo' },
          { title: 'SEO & content', status: 'todo', tags: [tag('SEO', 'blue')] },
          { title: 'Email lifecycle', status: 'todo' },
          { title: 'Referral loop', status: 'todo' },
        ],
      },
    ],
  },
  {
    id: 'tpl-feature-build',
    name: 'Feature Build',
    description: 'Ship a single feature end to end',
    color: 'teal',
    icon: 'ti-git-branch',
    builtin: true,
    tags: [tag('Feature', 'teal')],
    modules: [
      {
        name: 'Spec',
        icon: 'ti-file-description',
        color: 'blue',
        items: [
          { title: 'Problem & goals', status: 'todo' },
          { title: 'Acceptance criteria', status: 'todo' },
          { title: 'Edge cases & risks', status: 'todo' },
        ],
      },
      {
        name: 'Build',
        icon: 'ti-code',
        color: 'teal',
        items: [
          { title: 'Data model / migration', status: 'todo' },
          { title: 'Backend / API', status: 'todo' },
          { title: 'UI implementation', status: 'todo' },
        ],
      },
      {
        name: 'Verify',
        icon: 'ti-checklist',
        color: 'amber',
        items: [
          { title: 'Tests', status: 'todo' },
          { title: 'Code review', status: 'todo' },
          { title: 'QA pass', status: 'todo' },
        ],
      },
      {
        name: 'Ship',
        icon: 'ti-rocket',
        color: 'coral',
        items: [
          { title: 'Feature flag / rollout', status: 'todo' },
          { title: 'Docs & changelog', status: 'todo' },
          { title: 'Monitor & follow-up', status: 'todo' },
        ],
      },
    ],
  },
  {
    id: 'tpl-client-website',
    name: 'Client Website',
    description: 'Agency delivery, discovery to handoff',
    color: 'coral',
    icon: 'ti-briefcase',
    builtin: true,
    tags: [tag('Client', 'coral')],
    modules: [
      {
        name: 'Discovery',
        icon: 'ti-search',
        color: 'blue',
        items: [
          { title: 'Kickoff & brief', status: 'todo' },
          { title: 'Sitemap & content plan', status: 'todo' },
          { title: 'Moodboard & references', status: 'todo' },
        ],
      },
      {
        name: 'Design',
        icon: 'ti-palette',
        color: 'violet',
        items: [
          { title: 'Homepage design', status: 'todo' },
          { title: 'Inner page templates', status: 'todo' },
          { title: 'Client review & sign-off', status: 'todo', tags: [tag('Client', 'coral')] },
        ],
      },
      {
        name: 'Development',
        icon: 'ti-code',
        color: 'teal',
        items: [
          { title: 'Build pages', status: 'todo' },
          { title: 'CMS integration', status: 'todo' },
          { title: 'Responsive & cross-browser', status: 'todo' },
          { title: 'Forms & integrations', status: 'todo' },
        ],
      },
      {
        name: 'Content',
        icon: 'ti-file-text',
        color: 'amber',
        items: [
          { title: 'Copywriting', status: 'todo' },
          { title: 'Imagery & assets', status: 'todo' },
          { title: 'SEO metadata', status: 'todo', tags: [tag('SEO', 'blue')] },
        ],
      },
      {
        name: 'Handoff',
        icon: 'ti-package-export',
        color: 'coral',
        items: [
          { title: 'QA & bug fixes', status: 'todo' },
          { title: 'Deploy to production', status: 'todo', tags: [tag('High', 'red')] },
          { title: 'Training & documentation', status: 'todo' },
          { title: 'Invoice & wrap-up', status: 'todo' },
        ],
      },
    ],
  },
  {
    id: 'tpl-personal-goals',
    name: 'Personal Goals',
    description: 'Lightweight personal task tracking',
    color: 'amber',
    icon: 'ti-target',
    builtin: true,
    tags: [tag('Personal', 'amber')],
    modules: [
      {
        name: 'This week',
        icon: 'ti-calendar-week',
        color: 'amber',
        items: [
          { title: 'Top priority', status: 'todo', tags: [tag('High', 'red')] },
          { title: 'Second task', status: 'todo' },
          { title: 'Third task', status: 'todo' },
        ],
      },
      {
        name: 'Backlog',
        icon: 'ti-inbox',
        color: 'gray',
        items: [
          { title: 'Someday / maybe', status: 'todo' },
          { title: 'Idea to explore', status: 'todo' },
        ],
      },
      {
        name: 'Done',
        icon: 'ti-circle-check',
        color: 'teal',
        items: [],
      },
    ],
  },
  {
    id: 'tpl-hiring',
    name: 'Hiring Pipeline',
    description: 'Source, screen, interview and close candidates',
    color: 'coral',
    icon: 'ti-users',
    builtin: true,
    tags: [tag('Hiring', 'coral')],
    modules: [
      {
        name: 'Role & JD', icon: 'ti-file-description', color: 'blue', items: [
          { title: 'Define role & scorecard' },
          { title: 'Write job description' },
          { title: 'Agree comp range & approvals' },
          { title: 'Publish to boards & referrals' },
        ],
      },
      {
        name: 'Sourcing', icon: 'ti-search', color: 'violet', items: [
          { title: 'Inbound applicants' },
          { title: 'Outbound / LinkedIn outreach' },
          { title: 'Referrals' },
        ],
      },
      {
        name: 'Screening', icon: 'ti-phone', color: 'amber', items: [
          { title: 'Resume shortlist' },
          { title: 'Recruiter phone screen' },
          { title: 'Assignment / test' },
        ],
      },
      {
        name: 'Interviews', icon: 'ti-users', color: 'teal', items: [
          { title: 'Round 1 — hiring manager' },
          { title: 'Round 2 — panel / technical' },
          { title: 'Values / culture fit' },
          { title: 'Debrief & scorecards' },
        ],
      },
      {
        name: 'Offer & Close', icon: 'ti-circle-check', color: 'teal', items: [
          { title: 'Reference checks' },
          { title: 'Prepare & send offer', tags: [tag('High', 'red')] },
          { title: 'Negotiation' },
          { title: 'Signed — handoff to onboarding' },
        ],
      },
    ],
  },
  {
    id: 'tpl-onboarding',
    name: 'Employee Onboarding',
    description: 'Ramp a new hire from offer to first 90 days',
    color: 'teal',
    icon: 'ti-user-plus',
    builtin: true,
    tags: [tag('People', 'teal')],
    modules: [
      {
        name: 'Before Day 1', icon: 'ti-checklist', color: 'blue', items: [
          { title: 'Send welcome email & schedule' },
          { title: 'Provision laptop & accounts', tags: [tag('High', 'red')] },
          { title: 'Assign a buddy / mentor' },
          { title: 'Prepare workspace & access' },
        ],
      },
      {
        name: 'Week 1', icon: 'ti-calendar-week', color: 'violet', items: [
          { title: 'Team intros & 1:1s' },
          { title: 'Tools & systems walkthrough' },
          { title: 'Role expectations & goals' },
          { title: 'HR & policies' },
        ],
      },
      {
        name: 'First 30 Days', icon: 'ti-target', color: 'amber', items: [
          { title: 'First owned task' },
          { title: 'Shadow key meetings' },
          { title: '30-day check-in' },
        ],
      },
      {
        name: 'First 90 Days', icon: 'ti-trophy', color: 'teal', items: [
          { title: 'Own a project end to end' },
          { title: 'Two-way feedback' },
          { title: '90-day review' },
        ],
      },
    ],
  },
  {
    id: 'tpl-marketing',
    name: 'Marketing Campaign',
    description: 'Plan, produce, launch and measure a campaign',
    color: 'amber',
    icon: 'ti-broadcast',
    builtin: true,
    tags: [tag('Marketing', 'amber')],
    modules: [
      {
        name: 'Strategy', icon: 'ti-bulb', color: 'violet', items: [
          { title: 'Goal & KPIs' },
          { title: 'Audience & positioning' },
          { title: 'Budget & timeline' },
        ],
      },
      {
        name: 'Content', icon: 'ti-palette', color: 'coral', items: [
          { title: 'Messaging & copy' },
          { title: 'Creative & assets' },
          { title: 'Landing page' },
        ],
      },
      {
        name: 'Channels', icon: 'ti-world', color: 'blue', items: [
          { title: 'Email' },
          { title: 'Social' },
          { title: 'Paid ads', tags: [tag('SEO', 'blue')] },
        ],
      },
      {
        name: 'Launch', icon: 'ti-rocket', color: 'teal', items: [
          { title: 'QA links & tracking' },
          { title: 'Go live', tags: [tag('High', 'red')] },
          { title: 'Announce internally' },
        ],
      },
      {
        name: 'Measure', icon: 'ti-chart-bar', color: 'amber', items: [
          { title: 'Track KPIs' },
          { title: 'Report & learnings' },
        ],
      },
    ],
  },
  {
    id: 'tpl-event',
    name: 'Event Planning',
    description: 'From concept to run-of-show to wrap-up',
    color: 'violet',
    icon: 'ti-calendar',
    builtin: true,
    tags: [tag('Event', 'violet')],
    modules: [
      {
        name: 'Concept', icon: 'ti-bulb', color: 'violet', items: [
          { title: 'Goals & theme' },
          { title: 'Budget' },
          { title: 'Date & venue shortlist' },
        ],
      },
      {
        name: 'Logistics', icon: 'ti-checklist', color: 'blue', items: [
          { title: 'Venue booking & contracts', tags: [tag('High', 'red')] },
          { title: 'Catering / AV' },
          { title: 'Travel & accommodation' },
        ],
      },
      {
        name: 'Promotion', icon: 'ti-broadcast', color: 'amber', items: [
          { title: 'Invites / registration' },
          { title: 'Social & email' },
          { title: 'Speakers / guests' },
        ],
      },
      {
        name: 'Run of Show', icon: 'ti-clipboard-list', color: 'coral', items: [
          { title: 'Agenda & timings' },
          { title: 'Roles & assignments' },
          { title: 'Rehearsal' },
        ],
      },
      {
        name: 'Wrap-up', icon: 'ti-circle-check', color: 'teal', items: [
          { title: 'Thank-yous & feedback' },
          { title: 'Reconcile costs' },
          { title: 'Retro' },
        ],
      },
    ],
  },
  {
    id: 'tpl-sales',
    name: 'Sales Pipeline',
    description: 'Move deals from lead to closed',
    color: 'blue',
    icon: 'ti-coin',
    builtin: true,
    tags: [tag('Sales', 'teal')],
    modules: [
      {
        name: 'Leads', icon: 'ti-inbox', color: 'gray', items: [
          { title: 'New inbound lead' },
          { title: 'Outbound prospect' },
        ],
      },
      {
        name: 'Qualified', icon: 'ti-target', color: 'blue', items: [
          { title: 'Discovery call' },
          { title: 'Needs & budget confirmed' },
        ],
      },
      {
        name: 'Proposal', icon: 'ti-file-text', color: 'violet', items: [
          { title: 'Demo' },
          { title: 'Send proposal / quote' },
        ],
      },
      {
        name: 'Negotiation', icon: 'ti-businessplan', color: 'amber', items: [
          { title: 'Handle objections' },
          { title: 'Terms & pricing' },
        ],
      },
      {
        name: 'Closed', icon: 'ti-circle-check', color: 'teal', items: [
          { title: 'Won — kickoff', tags: [tag('High', 'red')] },
          { title: 'Lost — reason logged' },
        ],
      },
    ],
  },
]

/**
 * Build a fresh project Node tree from a template, assigning brand-new ids and
 * shortIds that don't collide with anything already in `existingRoots`.
 */
export function instantiateTemplate(
  tpl: Template,
  existingRoots: Node[],
  name?: string,
): Node {
  const projName = (name && name.trim()) || tpl.name
  const prefix = projectPrefix(projName)
  const root = newNode(projName, {
    color: tpl.color,
    icon: tpl.icon,
    status: 'todo',
    description: tpl.description,
    tags: tpl.tags ? tpl.tags.map(t => ({ ...t })) : undefined,
  })
  // Include `root` in the working set so nextShortId sees the ids we assign as
  // we build the tree, keeping every shortId unique.
  const working = [...existingRoots, root]
  root.shortId = nextShortId(existingRoots, prefix)

  for (const mod of tpl.modules) {
    const modNode = newNode(mod.name, {
      color: mod.color ?? tpl.color,
      icon: mod.icon,
      status: 'todo',
    })
    modNode.shortId = nextShortId(working, prefix)
    root.children.push(modNode)

    for (const item of mod.items) {
      const itemNode = newNode(item.title, {
        status: item.status ?? 'todo',
        color: mod.color ?? tpl.color,
        priority: item.priority,
        tags: item.tags ? item.tags.map(t => ({ ...t })) : undefined,
      })
      itemNode.shortId = nextShortId(working, prefix)
      modNode.children.push(itemNode)
    }
  }

  return root
}

/**
 * Capture an existing project as a reusable template: keep the structure,
 * titles, colors, icons, statuses and tags, but drop ids and timestamps.
 */
export function projectToTemplate(node: Node, id: string): Template {
  return {
    id,
    name: node.title,
    description: node.description ?? '',
    color: node.color ?? 'blue',
    icon: node.icon ?? 'ti-folder',
    builtin: false,
    tags: node.tags ? node.tags.map(t => ({ ...t })) : undefined,
    modules: node.children.map(mod => ({
      name: mod.title,
      color: mod.color,
      icon: mod.icon,
      items: mod.children.map(task => ({
        title: task.title,
        status: task.status,
        priority: task.priority,
        tags: task.tags ? task.tags.map(t => ({ ...t })) : undefined,
      })),
    })),
  }
}
