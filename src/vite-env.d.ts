/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOCAL_ONLY?: string;
  readonly VITE_SATELLITE_TILE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
