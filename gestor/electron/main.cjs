const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
let localServer;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function startLocalStaticServer(publicDir, port = 5178) {
  return new Promise((resolve) => {
    localServer = http.createServer((req, res) => {
      let safePath = path.normalize(req.url.split('?')[0]).replace(/^(\.\.[\/\\])+/, '');
      if (safePath === '/') safePath = '/index.html';

      let filePath = path.join(publicDir, safePath);

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          filePath = path.join(publicDir, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(filePath, (readErr, content) => {
          if (readErr) {
            res.writeHead(500);
            res.end('Server Error');
          } else {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Cache-Control': 'no-cache',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(content, 'utf-8');
          }
        });
      });
    });

    localServer.listen(port, '127.0.0.1', () => {
      console.log(`Local static server running at http://127.0.0.1:${port}`);
      resolve(`http://127.0.0.1:${port}`);
    }).on('error', () => {
      // Fallback to random free port if 5178 is busy
      localServer.listen(0, '127.0.0.1', () => {
        const p = localServer.address().port;
        resolve(`http://127.0.0.1:${p}`);
      });
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'MIAR ERP - Gestor Estabelecimento',
    backgroundColor: '#FFFFFF', // bate com o fundo do vídeo de preload (PreloadSplash.tsx)
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  Menu.setApplicationMenu(null);

  let targetUrl = process.env.ELECTRON_START_URL;

  if (!targetUrl) {
    const distPublicDir = path.join(__dirname, '../dist/public');
    if (fs.existsSync(distPublicDir)) {
      targetUrl = await startLocalStaticServer(distPublicDir);
    } else {
      targetUrl = 'http://localhost:5174';
    }
  }

  console.log('Loading app URL:', targetUrl);
  mainWindow.loadURL(targetUrl).catch((err) => {
    console.error('Failed to load URL, falling back to localhost:5174:', err);
    mainWindow.loadURL('http://localhost:5174');
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (localServer) localServer.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
