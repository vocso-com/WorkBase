import type { Node, Status } from '../types'
import { HOME_ORDER, STATUS } from '../theme'
import { useStore } from '../store/useStore'
import { useNav } from '../hooks/useNav'
import { useNewProject } from '../hooks/useNewProject'
import { ProjectCard } from './ProjectCard'
import { Icon } from './ui/Icon'

export function ProjectsHome() {
  const roots = useStore(s => s.doc.roots)

  const lanes = HOME_ORDER.map(status => ({
    status,
    projects: roots.filter(n => n.status === status),
  })).filter(lane => lane.projects.length > 0 || lane.status === 'doing')

  return (
    <div data-testid="projects-home">
      {lanes.map(lane => (
        <Lane key={lane.status} status={lane.status} projects={lane.projects} />
      ))}
    </div>
  )
}

function Lane({ status, projects }: { status: Status; projects: Node[] }) {
  return (
    <div className="lane">
      <div className="lanehead">
        <span className="sdot" style={{ background: STATUS[status].dot }} />
        {STATUS[status].label}
        <span className="cnt">{projects.length}</span>
      </div>
      <div className="grid">
        {projects.map(node => (
          <ProjectCard key={node.id} node={node} onOpen={() => useNav.getState().open(node.id)} />
        ))}
        {status === 'doing' ? (
          <div className="card newcard" onClick={() => useNewProject.getState().show()}>
            <Icon name="ti-plus" style={{ fontSize: 24 }} />
            New project
          </div>
        ) : null}
      </div>
    </div>
  )
}
