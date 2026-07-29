export function Icon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <i className={`ti ${name} ${className}`} aria-hidden style={style} />
}
