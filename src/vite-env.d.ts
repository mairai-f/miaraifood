/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    openExternal: (url: string) => boolean;
  };
}
