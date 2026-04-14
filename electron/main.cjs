const path = require('path');
const { app, BrowserWindow, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const UPDATE_CHECK_DELAY_MS = 15_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;
let autoUpdatesConfigured = false;
const APP_USER_MODEL_ID = 'com.happycash.desktop';

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const getWindowIconPath = () => {
  const iconFilename = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return path.join(__dirname, '..', 'build', iconFilename);
};

app.setName('HappyCash');

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

const checkForUpdates = async () => {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('Erro ao procurar atualizacoes automáticas:', error);
  }
};

const setupAutoUpdates = (mainWindow) => {
  if (isDevelopment || autoUpdatesConfigured) return;
  autoUpdatesConfigured = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('Verificando atualizacoes do HappyCash...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`Atualizacao ${info?.version || ''} encontrada. Baixando em segundo plano...`);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Nenhuma atualizacao nova encontrada.');
  });

  autoUpdater.on('error', (error) => {
    console.error('Falha no auto-update:', error);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow;

    if (!targetWindow || targetWindow.isDestroyed()) {
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return;
    }

    const { response } = await dialog.showMessageBox(targetWindow, {
      type: 'info',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
      title: 'Atualizacao pronta',
      message: 'Uma nova versao do HappyCash foi baixada.',
      detail: `A versao ${info?.version || 'mais recente'} ja esta pronta para instalar. Reinicie agora para concluir a atualizacao.`,
      noLink: true,
    });

    if (response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
    }
  });

  const initialTimer = setTimeout(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_DELAY_MS);

  const recurringTimer = setInterval(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);

  app.on('before-quit', () => {
    clearTimeout(initialTimer);
    clearInterval(recurringTimer);
  });
};

const createMainWindow = async () => {
  const mainWindow = new BrowserWindow({
    show: false,
    width: 1366,
    height: 840,
    minWidth: 1120,
    minHeight: 700,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#050505',
    icon: getWindowIconPath(),
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

  mainWindow.once('ready-to-show', () => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.setFullScreen(true);
    mainWindow.show();
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    await mainWindow.loadURL(devUrl);
    return mainWindow;
  }

  await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  return mainWindow;
};

app.whenReady().then(() => {
  createMainWindow()
    .then((mainWindow) => {
      setupAutoUpdates(mainWindow);
    })
    .catch((error) => {
      console.error('Erro ao iniciar app desktop:', error);
    });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
        .then((mainWindow) => {
          setupAutoUpdates(mainWindow);
        })
        .catch((error) => {
          console.error('Erro ao reabrir app desktop:', error);
        });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
