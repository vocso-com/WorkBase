import { Icon } from './ui/Icon'
import { AvatarMenu } from './AvatarMenu'

export function TopBar({ onExport, onImport }: { onExport: () => void; onImport: () => void }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px',
        position: 'sticky', top: 0, background: 'color-mix(in srgb,var(--bg) 82%, transparent)',
        backdropFilter: 'blur(8px)', zIndex: 30, borderBottom: '1px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#6d5ce0,#3b82c4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Icon name="ti-checkup-list" />
        </div>
        <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, letterSpacing: '-.01em' }}>Manage</h1>
      </div>
      <AvatarMenu onExport={onExport} onImport={onImport} />
    </div>
  )
}
