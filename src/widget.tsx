import ReactDOM from 'react-dom/client'
import { WidgetApp } from './components/WidgetApp'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import './index.css'

// Mark this window as the widget so the store never persists from here — the
// main window is the single writer (widget changes are routed to it).
;(window as unknown as { __WB_WIDGET__?: boolean }).__WB_WIDGET__ = true

// The native window is transparent; clear the app's dotted canvas from every
// layer (html / body / #root) so only the floating card shows — no dots and no
// translucent fill around it.
document.documentElement.classList.add('wb-widget-window')

// Standalone entry for the native always-on-top reminder window. It renders
// only the widget (no router, no main app), so nothing can redirect it.
ReactDOM.createRoot(document.getElementById('root')!).render(<WidgetApp />)
