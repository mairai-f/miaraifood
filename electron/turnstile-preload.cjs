const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopTurnstile', {
  complete: (token) => ipcRenderer.send('turnstile:complete', token),
  cancel: (message) => ipcRenderer.send('turnstile:cancel', message),
});
