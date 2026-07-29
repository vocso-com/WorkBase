import { Icon } from './ui/Icon'

export type ViewKind = 'board' | 'kanban'

export function ViewToggle({ view, onChange }: { view: ViewKind; onChange: (view: ViewKind) => void }) {
  return (
    <div className="toggle">
      <button type="button" className={view === 'board' ? 'on' : ''} onClick={() => onChange('board')}>
        <Icon name="ti-layout-grid" /> Board
      </button>
      <button type="button" className={view === 'kanban' ? 'on' : ''} onClick={() => onChange('kanban')}>
        <Icon name="ti-layout-kanban" /> Kanban
      </button>
    </div>
  )
}
