import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router'
import '@fontsource-variable/onest'
import './styles/tokens.css'
import './styles/base.css'
import './styles/controls.css'
import './styles/layout.css'
import './styles/cards.css'
import './styles/pages.css'
import './styles/pages-inner.css'
import './styles/player.css'
import { App } from './App'

// Clean URLs need the host to serve index.html for unknown paths (SPA fallback).
// For hosts without rewrites build with VITE_ROUTER_MODE=hash to get /#/catalog style links.
const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Filters, search and tabs live in the URL and are bound to inputs. With router updates deferred
        through startTransition a controlled input lags behind typing and drops characters, so
        navigation state is applied synchronously. */}
    <Router useTransitions={false}>
      <App />
    </Router>
  </StrictMode>,
)
