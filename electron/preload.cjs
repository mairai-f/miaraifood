const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.sendSync('open-external-url', url),
  printHtml: async (html) => {
    const result = await ipcRenderer.invoke('print-html', html);
    return Boolean(result?.success);
  },
  printer: {
    list: () => ipcRenderer.invoke('printer:list'),
    select: (printerName) => ipcRenderer.invoke('printer:select', printerName),
    test: () => ipcRenderer.invoke('printer:test'),
  },
  fiscal: {
    archiveDocument: (payload) => ipcRenderer.invoke('fiscal:archive-document', payload),
  },
  turnstile: {
    requestToken: (action) => ipcRenderer.invoke('turnstile:request', { action }),
  },
  // Armazenamento seguro via OS keychain (safeStorage do Electron).
  // O renderer nunca acessa safeStorage diretamente — tudo passa por IPC
  // com contextIsolation ativo. Dados são inacessíveis via F12 / DevTools.
  secureStorage: {
    isAvailable: () => ipcRenderer.invoke('secure-storage:is-available'),
    read: (key) => ipcRenderer.invoke('secure-storage:read', key),
    write: (key, value) => ipcRenderer.invoke('secure-storage:write', key, value),
    delete: (key) => ipcRenderer.invoke('secure-storage:delete', key),
  },
  app: {
    getRuntimeInfo: () => ipcRenderer.invoke('app:get-runtime-info'),
    getRuntimeInfoSync: () => ipcRenderer.sendSync('app:get-runtime-info-sync'),
    getUpdateStatus: () => ipcRenderer.invoke('app:get-update-status'),
    checkForUpdates: (options) => ipcRenderer.invoke('app:check-for-updates', options),
    installUpdate: () => ipcRenderer.invoke('app:install-update'),
    openUpdateDownload: () => ipcRenderer.invoke('app:open-update-download'),
    onUpdateStatus: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('app:update-status-changed', listener);
      return () => ipcRenderer.removeListener('app:update-status-changed', listener);
    },
  },
  offline: {
    replaceSnapshot: (payload) => ipcRenderer.invoke('offline:replace-snapshot', payload),
    getSnapshot: (payload) => ipcRenderer.invoke('offline:get-snapshot', payload),
    enqueue: (payload) => ipcRenderer.invoke('offline:enqueue', payload),
    listQueue: (payload) => ipcRenderer.invoke('offline:list-queue', payload),
    updateQueueItem: (payload) => ipcRenderer.invoke('offline:update-queue-item', payload),
    recordConflict: (payload) => ipcRenderer.invoke('offline:record-conflict', payload),
    listConflicts: (payload) => ipcRenderer.invoke('offline:list-conflicts', payload),
    resolveConflict: (payload) => ipcRenderer.invoke('offline:resolve-conflict', payload),
    retryOperation: (payload) => ipcRenderer.invoke('offline:retry-operation', payload),
    cleanupData: (payload) => ipcRenderer.invoke('offline:cleanup-data', payload),
    getStatus: (payload) => ipcRenderer.invoke('offline:get-status', payload),
  },
});
