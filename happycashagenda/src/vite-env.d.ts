/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENDA_BUSINESS_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
