/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    openExternal: (url: string) => boolean;
    printHtml: (html: string) => Promise<boolean>;
  };
}
