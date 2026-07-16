/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_AUTH_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface Window {
  electronAPI?: {
    openExternal: (url: string) => boolean;
    printHtml: (html: string) => Promise<boolean>;
    printer?: {
      list: () => Promise<{
        selectedName: string | null;
        defaultName: string | null;
        printers: Array<{
          name: string;
          displayName: string;
          description: string;
          isDefault: boolean;
        }>;
      }>;
      select: (printerName: string | null) => Promise<{ success: boolean; selectedName?: string | null; error?: string }>;
      test: () => Promise<{ success: boolean; error?: string | null }>;
    };
    fiscal?: {
      archiveDocument: (payload: {
        html: string;
        metadata: Record<string, unknown>;
      }) => Promise<{
        success: boolean;
        directory?: string;
        htmlPath?: string;
        jsonPath?: string;
        error?: string | null;
      }>;
    };
    turnstile?: {
      requestToken: (action: string) => Promise<{
        success: boolean;
        token?: string;
        error?: string;
      }>;
    };
    app?: {
      getRuntimeInfo: () => Promise<{
        appVersion: string;
        isPackaged: boolean;
        platform: string;
        databasePath: string;
        updateChannel: string;
        productContext: "happycash" | "happycashfood";
        installerToken: string | null;
      }>;
      getRuntimeInfoSync: () => {
        appVersion: string;
        isPackaged: boolean;
        platform: string;
        databasePath: string;
        updateChannel: string;
        productContext: "happycash" | "happycashfood";
        installerToken: string | null;
      };
      getUpdateStatus: () => Promise<unknown>;
      checkForUpdates: (options?: { autoInstallOnDownloaded?: boolean }) => Promise<unknown>;
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
  desktopTurnstile?: {
    complete: (token: string) => void;
    cancel: (message: string) => void;
  };
}
