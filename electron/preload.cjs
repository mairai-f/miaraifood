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
  app: {
    getRuntimeInfo: () => ipcRenderer.invoke('app:get-runtime-info'),
    getUpdateStatus: () => ipcRenderer.invoke('app:get-update-status'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
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
