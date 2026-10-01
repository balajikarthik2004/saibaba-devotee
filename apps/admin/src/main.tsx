import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { bootstrapI18n } from '@saibaba/core/features/i18n'
import App from './App.tsx'
import './index.css'

bootstrapI18n()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
