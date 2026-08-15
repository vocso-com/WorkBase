import ReactDOM from 'react-dom/client'
import { WidgetApp } from './components/WidgetApp'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import './index.css'

// Standalone entry for the native always-on-top reminder window. It renders
// only the widget (no router, no main app), so nothing can redirect it.
ReactDOM.createRoot(document.getElementById('root')!).render(<WidgetApp />)
