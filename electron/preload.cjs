<<<<<<< HEAD
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.sendSync('open-external-url', url),
});
=======
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {});
>>>>>>> main
