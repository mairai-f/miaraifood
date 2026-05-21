/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    printHtml?: (html: string) => Promise<boolean>;
  };
}
