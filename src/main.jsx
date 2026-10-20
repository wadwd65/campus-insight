import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './ui-polish.css'
import './landing.css'
import './experience.css'
import './answer-lens.css'
import './scene-details.css'
import './interaction.css'
import './campus-map.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
