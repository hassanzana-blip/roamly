import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/TRPCProvider"
import { PageMetaProvider } from "@/providers/helmet"
import { LangProvider } from "@/lib/i18n"
import ErrorBoundary from "@/components/app/ErrorBoundary"
import App from './App.tsx'

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
