/// <reference types="vite/client" />

// Vite client types: let TypeScript accept CSS, image and other asset imports
// (e.g. `import "./styles/tokens.css"`) and type import.meta.env.
// TypeScript 6+ checks side-effect imports by default and errors without this.

interface ImportMetaEnv {
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
