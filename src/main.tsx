/* Main entry point for the application - renders the root React component */

// Polyfill defensivo para CSSStyleSheet.prototype.cssRules
// Protege ferramentas e bibliotecas externas (como html-to-image e dom-to-image)
// de estourar SecurityError DOMException ao tentar ler cssRules de stylesheets cross-origin.
if (typeof window !== 'undefined' && typeof CSSStyleSheet !== 'undefined') {
  try {
    const proto = CSSStyleSheet.prototype
    const originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'cssRules')
    if (originalDescriptor && originalDescriptor.get) {
      const originalGet = originalDescriptor.get
      Object.defineProperty(proto, 'cssRules', {
        configurable: true,
        enumerable: originalDescriptor.enumerable,
        get() {
          try {
            return originalGet.call(this)
          } catch (e: any) {
            // Se for SecurityError cross-origin, retorna CSSRuleList vazio ou array vazio
            // para que a iteração da biblioteca termine graciosamente sem lançar exceção fatal.
            if (e?.name === 'SecurityError' || String(e?.message).includes('Cannot access rules')) {
              return [] as unknown as CSSRuleList
            }
            throw e
          }
        },
      })
    }
  } catch {
    // Falha silenciosa caso o browser impeça redefinição de propriedades DOM
  }
}

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
