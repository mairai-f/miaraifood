/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WINDOWS_DESKTOP_DOWNLOAD_URL?: string;
  readonly VITE_LINUX_DESKTOP_DOWNLOAD_URL?: string;
  readonly VITE_HAPPYCASH_AGENDA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
