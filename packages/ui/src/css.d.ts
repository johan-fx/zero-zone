// Ambient declaration so this package's own `tsc --noEmit` accepts the
// side-effect `import './primitives.css'` in src/web/index.ts without
// depending on vite/client types (consumers like apps/web-ui already have
// those via their own Vite tsconfig).
declare module '*.css';
