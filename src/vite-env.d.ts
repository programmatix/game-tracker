/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BGG_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

