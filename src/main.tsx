import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/manrope'
import './index.css'
import { TRPCProvider } from "@/providers/TRPCProvider"
import { PageMetaProvider } from "@/providers/helmet"
import { LangProvider } from "@/lib/i18n"
import ErrorBoundary, { clearStaleChunkFlag, reloadOnceForStaleChunk } from "@/components/app/ErrorBoundary"
import App from './App.tsx'

// Vite melder om en route-chunk som ikke lenger finnes (typisk rett etter en
// deploy). Én omlasting henter den nye versjonen i stedet for å stoppe søket.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForStaleChunk("Failed to fetch dynamically imported module")) event.preventDefault();
});
clearStaleChunkFlag();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <TRPCProvider>
          <PageMetaProvider>
            <LangProvider>
              <App />
            </LangProvider>
          </PageMetaProvider>
        </TRPCProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
