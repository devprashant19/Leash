import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Lenis from 'lenis';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/inter';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/700.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/sections.css';
import { App } from './App';

// Smooth scroll with Lenis defaults (as the reference). Off for reduced motion and touch-only devices.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none)').matches;
if (!reduce && !touch) {
  const lenis = new Lenis({ autoRaf: true, prevent: (node) => node.hasAttribute('data-lenis-prevent') });
  (window as unknown as { __lenis: Lenis }).__lenis = lenis;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
