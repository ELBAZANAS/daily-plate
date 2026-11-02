import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { Boundary } from './App.jsx'
import { StoreProvider } from './store.jsx'
import './styles.css'

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Boundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </Boundary>
  </StrictMode>,
)
