import { generateOperationalCss } from '@zona-cero/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

// Inject the shared operational design tokens (--zc-*) as CSS custom
// properties before anything renders, so styles.css and the @zona-cero/ui
// primitives can consume them instead of hardcoding colors/radii. See
// docs/design-system-visual-acceptance.md.
const tokenStyleTag = document.createElement('style');
tokenStyleTag.setAttribute('data-zona-cero-tokens', 'true');
tokenStyleTag.textContent = generateOperationalCss();
document.head.prepend(tokenStyleTag);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
