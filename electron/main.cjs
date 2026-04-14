const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const resolveRendererEntry = () => {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }

  return path.join(__dirname, '..', 'dist', 'index.html');
};

const createMainWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 840,
    minWidth: 1120,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#050505',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    const expectedOrigin = devServerUrl ? new URL(devServerUrl).origin : null;
    let navigationOrigin = null;

    try {
      navigationOrigin = new URL(navigationUrl).origin;
    } catch {
      return;
    }

    if (expectedOrigin && navigationOrigin === expectedOrigin) {
      return;
    }

    if (navigationUrl.startsWith('file://')) {
      return;
    }

    event.preventDefault();
    if (isHttpUrl(navigationUrl)) {
      shell.openExternal(navigationUrl);
    }
  });

  const rendererEntry = resolveRendererEntry();
  if (rendererEntry.startsWith('http://') || rendererEntry.startsWith('https://')) {
    await mainWindow.loadURL(rendererEntry);
  } else {
    await mainWindow.loadFile(rendererEntry);
  }
};

ipcMain.on('open-external-url', (event, url) => {
  if (!isHttpUrl(url)) {
    event.returnValue = false;
    return;
  }

  shell.openExternal(url);
  event.returnValue = true;
});

app.whenReady().then(() => {
  createMainWindow().catch((error) => {
    console.error('Erro ao iniciar janela principal:', error);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((error) => {
        console.error('Erro ao reabrir janela principal:', error);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
