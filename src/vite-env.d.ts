/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_AUTH_URL?: string;
}

interface Window {
  electronAPI?: {
    openExternal: (url: string) => boolean;
    printHtml: (html: string) => Promise<boolean>;
    app?: {
      getRuntimeInfo: () => Promise<{
        appVersion: string;
        isPackaged: boolean;
        platform: string;
        databasePath: string;
        updateChannel: string;
        productContext: "happycash" | "happycashfood";
      }>;
      getUpdateStatus: () => Promise<unknown>;
      checkForUpdates: () => Promise<unknown>;
      installUpdate: () => Promise<unknown>;
      openUpdateDownload: () => Promise<unknown>;
      onUpdateStatus: (callback: (status: unknown) => void) => () => void;
    };
    offline?: {
      replaceSnapshot: (payload: unknown) => Promise<unknown>;
      getSnapshot: (payload: unknown) => Promise<unknown>;
      enqueue: (payload: unknown) => Promise<unknown>;
      listQueue: (payload: unknown) => Promise<unknown>;
      updateQueueItem: (payload: unknown) => Promise<unknown>;
      recordConflict: (payload: unknown) => Promise<unknown>;
      listConflicts: (payload: unknown) => Promise<unknown>;
      resolveConflict: (payload: unknown) => Promise<unknown>;
      retryOperation: (payload: unknown) => Promise<unknown>;
      cleanupData: (payload: unknown) => Promise<unknown>;
      getStatus: (payload: unknown) => Promise<unknown>;
    };
  };
}
