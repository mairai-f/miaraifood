const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.sendSync('open-external-url', url),
  printHtml: async (html) => {
    const result = await ipcRenderer.invoke('print-html', html);
    return Boolean(result?.success);
  },
});
