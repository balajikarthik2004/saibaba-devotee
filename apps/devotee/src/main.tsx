import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { bootstrapI18n } from '@saibaba/core/features/i18n'
import App from './App.tsx'
import './index.css'
import './features/a11y/indic-fonts.css'
import './features/a11y/a11y.css'
import { initA11y } from './features/a11y/store'
import { registerServiceWorker } from './features/pwa/register'

bootstrapI18n()
initA11y()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker: production only (dev HMR must never be cached).
if (import.meta.env.PROD) registerServiceWorker()
