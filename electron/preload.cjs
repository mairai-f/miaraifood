const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.sendSync('open-external-url', url),
  printHtml: async (html) => {
    const result = await ipcRenderer.invoke('print-html', html);
    return Boolean(result?.success);
  },
  app: {
    getRuntimeInfo: () => ipcRenderer.invoke('app:get-runtime-info'),
    getUpdateStatus: () => ipcRenderer.invoke('app:get-update-status'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
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
    getStatus: (payload) => ipcRenderer.invoke('offline:get-status', payload),
  },
});
