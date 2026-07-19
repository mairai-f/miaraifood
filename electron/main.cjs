const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { requestDesktopTurnstileToken } = require('./desktop-turnstile.cjs');

const UPDATE_CHECK_DELAY_MS = 15_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_METADATA_RETRY_DELAY_MS = 60_000;
const UPDATE_AUTO_INSTALL_DELAY_MS = 900;
const UPDATE_INSTALL_RETRY_DELAY_MS = 8_000;
const UPDATE_INSTALL_STUCK_TIMEOUT_MS = 24_000;
const UPDATE_FORCE_QUIT_DELAY_MS = 4_500;
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;
const loadPackagedMetadata = () => {
  try {
    return require('../package.json');
  } catch {
    return {};
  }
};

const packagedMetadata = loadPackagedMetadata();
const PRODUCT_CONTEXT = 'happycash';
const APP_DISPLAY_NAME = 'HappyCash';
let autoUpdatesConfigured = false;
const APP_USER_MODEL_ID = 'com.happycash.desktop';
const HAPPYCASH_SITE_ORIGIN = (process.env.HAPPYCASH_SITE_ORIGIN || 'https://www.happycashsite.com.br').replace(/\/+$/, '');
const HAPPYCASH_APP_ORIGIN = (process.env.HAPPYCASH_APP_ORIGIN || 'https://app.happycashsite.com.br').replace(/\/+$/, '');
const DESKTOP_TURNSTILE_TIMEOUT_MS = 130_000;
const VALID_UPDATE_CHANNELS = new Set(['latest', 'beta', 'alpha']);
const OFFLINE_DB_FILENAME = 'happycash-concentrator.sqlite';
const configuredRendererDir = process.env.HAPPYCASH_RENDERER_DIR?.replace(/^\.?\//, '').trim();
const packagedRendererDir = typeof packagedMetadata.rendererDir === 'string'
  ? packagedMetadata.rendererDir.replace(/^\.?\//, '').trim()
  : '';
const RENDERER_DIR = configuredRendererDir || packagedRendererDir || 'dist';
const OFFLINE_DB_SCHEMA_VERSION = 2;
const OFFLINE_SYNC_RETENTION_DAYS = Number.parseInt(process.env.HAPPYCASH_OFFLINE_SYNC_RETENTION_DAYS || '30', 10);
const OFFLINE_CONFLICT_RETENTION_DAYS = Number.parseInt(process.env.HAPPYCASH_OFFLINE_CONFLICT_RETENTION_DAYS || '30', 10);
let offlineDb = null;
let updateState = {
  status: isDevelopment ? 'disabled' : 'idle',
  channel: null,
  currentVersion: app.getVersion(),
  availableVersion: null,
  downloadedVersion: null,
  downloadedFile: null,
  manualDownloadUrl: null,
  installStartedAt: null,
  progress: null,
  bytesPerSecond: null,
  transferred: null,
  total: null,
  checkedAt: null,
  error: null,
};
let pendingUpdateRetryTimer = null;
let pendingUpdateInstallTimer = null;
let pendingUpdateInstallWatchdogTimer = null;
let pendingUpdateForceQuitTimer = null;
let autoInstallDownloadedUpdate = false;
let updateInstallAttemptCount = 0;
let installingDownloadedUpdate = false;
const appendPrintLog = (event, details = {}) => {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    ...details,
  });

  console.log(`[printing] ${entry}`);
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'printing.log'), `${entry}\n`, 'utf8');
  } catch (error) {
    console.error('Nao foi possivel gravar o log de impressao:', error);
  }
};

const getInstallerTokenPath = () => {
  if (!app.isPackaged) return null;

  const installDir = path.dirname(process.execPath);
  return path.join(installDir, 'install-token.txt');
};

const readInstallerToken = () => {
  const tokenPath = getInstallerTokenPath();
  if (!tokenPath) return null;

  try {
    const rawValue = fs.readFileSync(tokenPath, 'utf8').trim();
    return rawValue || null;
  } catch {
    return null;
  }
};

const getRuntimeInfo = () => ({
  appVersion: app.getVersion(),
  isPackaged: app.isPackaged,
  platform: process.platform,
  databasePath: getOfflineDbPath(),
  updateChannel: getUpdateChannel(),
  productContext: PRODUCT_CONTEXT,
  installerToken: readInstallerToken(),
});

const getPrinterSettingsPath = () => path.join(app.getPath('userData'), 'printer-settings.json');
const readSelectedPrinterName = () => {
  try {
    const settings = JSON.parse(fs.readFileSync(getPrinterSettingsPath(), 'utf8'));
    return typeof settings?.printerName === 'string' && settings.printerName.trim()
      ? settings.printerName.trim()
      : null;
  } catch {
    return null;
  }
};
const writeSelectedPrinterName = (printerName) => {
  const normalizedName = typeof printerName === 'string' && printerName.trim()
    ? printerName.trim()
    : null;
  fs.writeFileSync(
    getPrinterSettingsPath(),
    `${JSON.stringify({ printerName: normalizedName }, null, 2)}\n`,
    'utf8',
  );
  return normalizedName;
};

const sanitizeFileSegment = (value, fallback = 'documento') => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || fallback;
};

const getFiscalArchiveRoot = () => path.join(app.getPath('documents'), APP_DISPLAY_NAME, 'NotasFiscais');

const archiveFiscalDocument = async (payload) => {
  const html = typeof payload?.html === 'string' ? payload.html : '';
  const metadata = payload?.metadata && typeof payload.metadata === 'object'
    ? payload.metadata
    : {};

  if (!html.trim()) {
    return {
      success: false,
      error: 'DANFE invalido para arquivamento.',
    };
  }

  const emittedAt = metadata.emittedAt ? new Date(metadata.emittedAt) : new Date();
  const safeDate = Number.isNaN(emittedAt.getTime()) ? new Date() : emittedAt;
  const yearMonth = `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}`;
  const directory = path.join(getFiscalArchiveRoot(), yearMonth);
  const number = sanitizeFileSegment(metadata.number, 'sem-numero');
  const series = sanitizeFileSegment(metadata.series, 'serie');
  const saleId = sanitizeFileSegment(metadata.saleId, 'venda');
  const accessKey = sanitizeFileSegment(metadata.accessKey, 'chave');
  const basename = `${yearMonth}-${series}-${number}-${saleId}-${accessKey.slice(-10)}`;
  const htmlPath = path.join(directory, `${basename}.html`);
  const jsonPath = path.join(directory, `${basename}.json`);

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(htmlPath, html, 'utf8');
    fs.writeFileSync(jsonPath, `${JSON.stringify({
      archivedAt: new Date().toISOString(),
      productContext: PRODUCT_CONTEXT,
      ...metadata,
    }, null, 2)}\n`, 'utf8');

    return {
      success: true,
      directory,
      htmlPath,
      jsonPath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel arquivar a nota fiscal no computador.',
    };
  }
};

const isDefaultPrinter = (printer) => Object.entries(printer?.options || {}).some(([key, value]) => (
  key.toLowerCase().includes('default')
  && ['true', '1', 'yes'].includes(String(value).toLowerCase())
));
const resolvePrinterSelection = (printers) => {
  const configuredPrinterName = readSelectedPrinterName()
    || process.env.HAPPYCASH_PRINTER_NAME?.trim()
    || null;
  const configuredPrinter = configuredPrinterName
    ? printers.find(printer => printer.name === configuredPrinterName || printer.displayName === configuredPrinterName)
    : null;

  return {
    configuredPrinterName,
    selectedPrinter: configuredPrinter
      || printers.find(isDefaultPrinter)
      || (printers.length === 1 ? printers[0] : null),
    configuredPrinterMissing: Boolean(configuredPrinterName && !configuredPrinter),
  };
};

const CSS_PIXEL_TO_MICRONS = 25400 / 96;
// RP80x2000 in the installed Epson TM PPD is 204.3 x 5669.3 points.
const RECEIPT_WIDTH_MICRONS = 72070;
const RECEIPT_PAGE_HEIGHT_MICRONS = 2000000;
const getReceiptPrintDetails = async (printWindow) => {
  await printWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const settle = () => {
        const fallbackTimer = setTimeout(finish, 600);
        const runAfterFrames = () => {
          clearTimeout(fallbackTimer);
          setTimeout(finish, 250);
        };

        if (typeof requestAnimationFrame !== 'function') {
          runAfterFrames();
          return;
        }

        requestAnimationFrame(() => {
          requestAnimationFrame(runAfterFrames);
        });
      };

      Promise.resolve(document.fonts?.ready).then(settle).catch(settle);
    })
  `);

  const receiptDetails = await printWindow.webContents.executeJavaScript(`
    (() => {
      const receipt = document.querySelector('[data-receipt-root]');
      const receiptRect = receipt?.getBoundingClientRect();
      const height = Math.max(
        receiptRect ? receiptRect.height : 0,
        receiptRect ? receiptRect.bottom : 0,
        receipt ? receipt.offsetHeight : 0,
        receipt ? receipt.scrollHeight : 0,
        document.scrollingElement ? document.scrollingElement.scrollHeight : 0,
        document.documentElement.scrollHeight || 0,
        document.documentElement.offsetHeight || 0,
        document.body.scrollHeight || 0,
        document.body.offsetHeight || 0,
      );

      return {
        height: Math.ceil(height),
        saleId: receipt?.getAttribute('data-sale-id') || null,
      };
    })()
  `);
  const safeHeightPixels = Number.isFinite(receiptDetails?.height) ? receiptDetails.height : 0;

  return {
    saleId: typeof receiptDetails?.saleId === 'string' ? receiptDetails.saleId : null,
    measuredHeightPixels: safeHeightPixels,
    estimatedPageCount: Math.max(
      1,
      Math.ceil((safeHeightPixels * CSS_PIXEL_TO_MICRONS) / RECEIPT_PAGE_HEIGHT_MICRONS),
    ),
    pageSize: {
      width: RECEIPT_WIDTH_MICRONS,
      height: RECEIPT_PAGE_HEIGHT_MICRONS,
    },
  };
};

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

  return path.join(__dirname, '..', RENDERER_DIR, 'index.html');
};

const getWindowIconPath = () => {
  const iconFilename = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return path.join(__dirname, '..', 'build', iconFilename);
};

const nowIso = () => new Date().toISOString();

const clampPositiveInteger = (value, fallback) => (
  Number.isInteger(value) && value > 0 ? value : fallback
);

const parseJson = (value, fallback = null) => {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getUpdateState = () => ({
  ...updateState,
});

const getDesktopManualDownloadRoute = () => {
  if (process.platform === 'win32') {
    return '/downloads/windows';
  }

  if (process.platform === 'linux') {
    const isAppImageRuntime = Boolean(process.env.APPIMAGE) || process.execPath.toLowerCase().endsWith('.appimage');
    return isAppImageRuntime ? '/downloads/linux-appimage' : '/downloads/linux-deb';
  }

  return '/dashboard';
};

const getManualUpdateUrl = () => `${HAPPYCASH_SITE_ORIGIN}${getDesktopManualDownloadRoute()}`;

const clearPendingUpdateRetry = () => {
  if (pendingUpdateRetryTimer) {
    clearTimeout(pendingUpdateRetryTimer);
    pendingUpdateRetryTimer = null;
  }
};

const clearPendingUpdateInstall = () => {
  if (pendingUpdateInstallTimer) {
    clearTimeout(pendingUpdateInstallTimer);
    pendingUpdateInstallTimer = null;
  }
};

const clearPendingUpdateInstallWatchdog = () => {
  if (pendingUpdateInstallWatchdogTimer) {
    clearTimeout(pendingUpdateInstallWatchdogTimer);
    pendingUpdateInstallWatchdogTimer = null;
  }
};

const clearPendingUpdateForceQuit = () => {
  if (pendingUpdateForceQuitTimer) {
    clearTimeout(pendingUpdateForceQuitTimer);
    pendingUpdateForceQuitTimer = null;
  }
};

const getUpdateInstallFailureMessage = () =>
  'A atualização foi baixada, mas o instalador não conseguiu reiniciar o HappyCash automaticamente. Abra Configurações > Desktop e offline para tentar novamente ou baixe a atualização manualmente.';

const markUpdateInstallFailed = (errorMessage = getUpdateInstallFailureMessage()) => {
  const state = getUpdateState();
  autoInstallDownloadedUpdate = false;
  clearPendingUpdateInstall();
  clearPendingUpdateInstallWatchdog();
  clearPendingUpdateForceQuit();
  updateInstallAttemptCount = 0;
  installingDownloadedUpdate = false;

  return setUpdateState({
    status: 'error',
    installStartedAt: null,
    manualDownloadUrl: getManualUpdateUrl(state.downloadedVersion || state.availableVersion),
    checkedAt: nowIso(),
    error: errorMessage,
  });
};

const scheduleUpdateInstallWatchdog = () => {
  clearPendingUpdateInstallWatchdog();

  pendingUpdateInstallWatchdogTimer = setTimeout(() => {
    pendingUpdateInstallWatchdogTimer = null;
    const state = getUpdateState();
    if (state.status !== 'installing') return;

    if (updateInstallAttemptCount < 2) {
      console.warn('Instalacao da atualizacao ainda nao reiniciou o app. Tentando novamente...');
      invokeQuitAndInstall('watchdog-retry');
      return;
    }

    console.error('Instalacao da atualizacao ficou presa apos o download.');
    markUpdateInstallFailed();
  }, updateInstallAttemptCount < 2 ? UPDATE_INSTALL_RETRY_DELAY_MS : UPDATE_INSTALL_STUCK_TIMEOUT_MS);
};

function invokeQuitAndInstall(trigger = 'manual') {
  updateInstallAttemptCount += 1;
  scheduleUpdateInstallWatchdog();
  clearPendingUpdateForceQuit();

  try {
    installingDownloadedUpdate = true;
    console.log(`Iniciando instalacao da atualizacao (${trigger}), tentativa ${updateInstallAttemptCount}.`);
    autoUpdater.quitAndInstall(false, true);

    pendingUpdateForceQuitTimer = setTimeout(() => {
      pendingUpdateForceQuitTimer = null;
      if (!installingDownloadedUpdate || getUpdateState().status !== 'installing') return;

      console.warn('Updater ainda nao encerrou o app. Fechando janelas para liberar a instalacao.');
      BrowserWindow.getAllWindows().forEach((window) => {
        if (!window.isDestroyed()) {
          window.destroy();
        }
      });
      app.quit();
    }, UPDATE_FORCE_QUIT_DELAY_MS);

    return { success: true };
  } catch (error) {
    console.error('Falha ao iniciar instalacao da atualizacao:', error);
    markUpdateInstallFailed(
      error instanceof Error ? error.message : 'Falha ao iniciar instalacao da atualizacao.',
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao iniciar instalacao da atualizacao.',
    };
  }
}

const startDownloadedUpdateInstall = (trigger = 'manual') => {
  const state = getUpdateState();

  if (state.status === 'installing') {
    return { success: true };
  }

  if (state.status !== 'downloaded') {
    return { success: false, error: 'Nenhuma atualizacao baixada para instalar.' };
  }

  autoInstallDownloadedUpdate = false;
  clearPendingUpdateInstall();
  clearPendingUpdateInstallWatchdog();
  updateInstallAttemptCount = 0;

  setUpdateState({
    status: 'installing',
    installStartedAt: nowIso(),
    error: null,
  });

  setImmediate(() => {
    invokeQuitAndInstall(trigger);
  });

  return { success: true };
};

const scheduleDownloadedUpdateInstall = (trigger = 'auto') => {
  clearPendingUpdateInstall();
  pendingUpdateInstallTimer = setTimeout(() => {
    pendingUpdateInstallTimer = null;
    startDownloadedUpdateInstall(trigger);
  }, UPDATE_AUTO_INSTALL_DELAY_MS);
};

const isReleaseMetadataPublishingError = (errorMessage) =>
  /Cannot find latest(?:-[\w]+)?\.yml in the latest release artifacts/i.test(errorMessage);

const scheduleUpdateMetadataRetry = (errorMessage) => {
  clearPendingUpdateRetry();

  const friendlyMessage = `A nova release ainda esta sendo publicada. O ${APP_DISPLAY_NAME} vai tentar novamente automaticamente em instantes.`;
  setUpdateState({
    status: 'publishing',
    checkedAt: nowIso(),
    error: friendlyMessage,
    manualDownloadUrl: getManualUpdateUrl(updateState.availableVersion || updateState.downloadedVersion),
  });

  pendingUpdateRetryTimer = setTimeout(() => {
    pendingUpdateRetryTimer = null;
    void checkForUpdates();
  }, UPDATE_METADATA_RETRY_DELAY_MS);

  console.warn('Metadados de update ainda indisponiveis, nova tentativa agendada.', errorMessage);
  return getUpdateState();
};

const setUpdateState = (patch) => {
  updateState = {
    ...updateState,
    ...patch,
  };

  const nextState = getUpdateState();
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('app:update-status-changed', nextState);
    }
  });

  return nextState;
};

const getOfflineDbPath = () => path.join(app.getPath('userData'), OFFLINE_DB_FILENAME);

const getPragmaNumber = (db, pragmaName) => {
  const pragmaRow = db.prepare(`PRAGMA ${pragmaName}`).get();
  return Number(pragmaRow?.[pragmaName] || 0);
};

const applyOfflineDbMigrations = (db) => {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS store_snapshots (
      owner_user_id TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_sync_queue (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'synced', 'conflict')),
      last_error TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS offline_sync_queue_owner_status_idx
      ON offline_sync_queue (owner_user_id, status, created_at);

    CREATE INDEX IF NOT EXISTS offline_sync_queue_owner_synced_at_idx
      ON offline_sync_queue (owner_user_id, status, synced_at DESC);

    CREATE TABLE IF NOT EXISTS offline_sync_conflicts (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS offline_sync_conflicts_owner_created_idx
      ON offline_sync_conflicts (owner_user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS offline_sync_conflicts_owner_operation_idx
      ON offline_sync_conflicts (owner_user_id, operation_id, resolved_at, created_at DESC);
  `);

  const currentVersion = getPragmaNumber(db, 'user_version');
  if (currentVersion < OFFLINE_DB_SCHEMA_VERSION) {
    db.exec(`PRAGMA user_version = ${OFFLINE_DB_SCHEMA_VERSION}`);
  }
};

const cleanupOfflineDataWithDb = (db, { ownerUserId } = {}) => {
  if (ownerUserId != null && (!ownerUserId || typeof ownerUserId !== 'string')) {
    throw new Error('ownerUserId invalido para limpeza do concentrador offline.');
  }

  const syncedRetentionDays = clampPositiveInteger(OFFLINE_SYNC_RETENTION_DAYS, 30);
  const conflictRetentionDays = clampPositiveInteger(OFFLINE_CONFLICT_RETENTION_DAYS, 30);
  const syncedCutoff = new Date(Date.now() - syncedRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const conflictCutoff = new Date(Date.now() - conflictRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const ownerScopeSql = ownerUserId ? ' AND owner_user_id = ?' : '';
  const ownerParams = ownerUserId ? [ownerUserId] : [];

  const deletedSyncedQueueItems = db.prepare(`
    DELETE FROM offline_sync_queue
    WHERE status = 'synced'
      AND synced_at IS NOT NULL
      AND synced_at < ?${ownerScopeSql}
  `).run(syncedCutoff, ...ownerParams).changes || 0;

  const deletedResolvedConflicts = db.prepare(`
    DELETE FROM offline_sync_conflicts
    WHERE resolved_at IS NOT NULL
      AND resolved_at < ?${ownerScopeSql}
  `).run(conflictCutoff, ...ownerParams).changes || 0;

  return {
    deletedSyncedQueueItems: Number(deletedSyncedQueueItems),
    deletedResolvedConflicts: Number(deletedResolvedConflicts),
  };
};

const getOfflineDb = () => {
  if (offlineDb) {
    return offlineDb;
  }

  const db = new DatabaseSync(getOfflineDbPath());
  applyOfflineDbMigrations(db);
  cleanupOfflineDataWithDb(db);

  offlineDb = db;
  return db;
};

const mapQueueRow = (row) => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  operationType: row.operation_type,
  payload: parseJson(row.payload_json, null),
  status: row.status,
  lastError: row.last_error,
  attemptCount: Number(row.attempt_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  syncedAt: row.synced_at || null,
});

const mapConflictRow = (row) => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  operationId: row.operation_id,
  operationType: row.operation_type,
  message: row.message,
  payload: parseJson(row.payload_json, null),
  createdAt: row.created_at,
  resolvedAt: row.resolved_at || null,
});

const replaceOfflineSnapshot = ({ ownerUserId, snapshot }) => {
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new Error('ownerUserId invalido para snapshot offline.');
  }

  const db = getOfflineDb();
  const updatedAt = nowIso();
  db.prepare(`
    INSERT INTO store_snapshots (owner_user_id, snapshot_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(owner_user_id) DO UPDATE
    SET snapshot_json = excluded.snapshot_json,
        updated_at = excluded.updated_at
  `).run(ownerUserId, JSON.stringify(snapshot ?? null), updatedAt);

  return {
    success: true,
    updatedAt,
  };
};

const getOfflineSnapshot = ({ ownerUserId }) => {
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new Error('ownerUserId invalido para leitura do snapshot offline.');
  }

  const db = getOfflineDb();
  const row = db.prepare(`
    SELECT snapshot_json, updated_at
    FROM store_snapshots
    WHERE owner_user_id = ?
  `).get(ownerUserId);

  return {
    snapshot: row ? parseJson(row.snapshot_json, null) : null,
    updatedAt: row?.updated_at || null,
  };
};

const enqueueOfflineOperation = ({ ownerUserId, operationType, payload }) => {
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new Error('ownerUserId invalido para fila offline.');
  }

  if (!operationType || typeof operationType !== 'string') {
    throw new Error('operationType invalido para fila offline.');
  }

  const db = getOfflineDb();
  const id = globalThis.crypto?.randomUUID?.() || `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const createdAt = nowIso();

  db.prepare(`
    INSERT INTO offline_sync_queue (
      id,
      owner_user_id,
      operation_type,
      payload_json,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, ownerUserId, operationType, JSON.stringify(payload ?? null), createdAt, createdAt);

  const row = db.prepare(`
    SELECT *
    FROM offline_sync_queue
    WHERE id = ?
  `).get(id);

  return row ? mapQueueRow(row) : null;
};

const listOfflineQueue = ({ ownerUserId, statuses }) => {
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new Error('ownerUserId invalido para leitura da fila offline.');
  }

  const db = getOfflineDb();
  const nextStatuses = Array.isArray(statuses) ? statuses.filter((value) => typeof value === 'string' && value) : [];

  if (nextStatuses.length === 0) {
    const rows = db.prepare(`
      SELECT *
      FROM offline_sync_queue
      WHERE owner_user_id = ?
      ORDER BY created_at ASC
    `).all(ownerUserId);

    return rows.map(mapQueueRow);
  }

  const placeholders = nextStatuses.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT *
    FROM offline_sync_queue
    WHERE owner_user_id = ?
      AND status IN (${placeholders})
    ORDER BY created_at ASC
  `).all(ownerUserId, ...nextStatuses);

  return rows.map(mapQueueRow);
};

const updateOfflineQueueItem = ({ id, status, lastError = null, syncedAt = null, incrementAttempt = false }) => {
  if (!id || typeof id !== 'string') {
    throw new Error('id invalido para atualizar a fila offline.');
  }

  const db = getOfflineDb();
  const updatedAt = nowIso();
  db.prepare(`
    UPDATE offline_sync_queue
    SET status = COALESCE(?, status),
        last_error = ?,
        synced_at = ?,
        attempt_count = attempt_count + CASE WHEN ? THEN 1 ELSE 0 END,
        updated_at = ?
    WHERE id = ?
  `).run(status ?? null, lastError, syncedAt, incrementAttempt ? 1 : 0, updatedAt, id);

  const row = db.prepare(`
    SELECT *
    FROM offline_sync_queue
    WHERE id = ?
  `).get(id);

  return row ? mapQueueRow(row) : null;
};

const recordOfflineConflict = ({ ownerUserId, operationId, operationType, message, payload }) => {
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new Error('ownerUserId invalido para conflito offline.');
  }

  if (!operationId || typeof operationId !== 'string') {
    throw new Error('operationId invalido para conflito offline.');
  }

  const db = getOfflineDb();
  const createdAt = nowIso();
  const payloadJson = JSON.stringify(payload ?? null);
  const existingConflict = db.prepare(`
    SELECT *
    FROM offline_sync_conflicts
    WHERE owner_user_id = ?
      AND operation_id = ?
      AND resolved_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `).get(ownerUserId, operationId);

  if (existingConflict) {
    db.prepare(`
      UPDATE offline_sync_conflicts
      SET operation_type = ?,
          message = ?,
          payload_json = ?,
          created_at = ?
      WHERE id = ?
    `).run(operationType, message, payloadJson, createdAt, existingConflict.id);

    const updatedConflict = db.prepare(`
      SELECT *
      FROM offline_sync_conflicts
      WHERE id = ?
    `).get(existingConflict.id);

    return updatedConflict ? mapConflictRow(updatedConflict) : null;
  }

  const id = globalThis.crypto?.randomUUID?.() || `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  db.prepare(`
    INSERT INTO offline_sync_conflicts (
      id,
      owner_user_id,
      operation_id,
      operation_type,
      message,
      payload_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    ownerUserId,
    operationId,
    operationType,
    message,
    payloadJson,
    createdAt,
  );

  const row = db.prepare(`
    SELECT *
    FROM offline_sync_conflicts
    WHERE id = ?
  `).get(id);

  return row ? mapConflictRow(row) : null;
};

const listOfflineConflicts = ({ ownerUserId }) => {
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new Error('ownerUserId invalido para leitura dos conflitos offline.');
  }

  const db = getOfflineDb();
  const rows = db.prepare(`
    SELECT *
    FROM offline_sync_conflicts
    WHERE owner_user_id = ?
    ORDER BY created_at DESC
  `).all(ownerUserId);

  return rows.map(mapConflictRow);
};

const resolveOfflineConflict = ({ id, resolved = true }) => {
  if (!id || typeof id !== 'string') {
    throw new Error('id invalido para atualizar conflito offline.');
  }

  const db = getOfflineDb();
  const resolvedAt = resolved ? nowIso() : null;
  db.prepare(`
    UPDATE offline_sync_conflicts
    SET resolved_at = ?
    WHERE id = ?
  `).run(resolvedAt, id);

  const row = db.prepare(`
    SELECT *
    FROM offline_sync_conflicts
    WHERE id = ?
  `).get(id);

  return row ? mapConflictRow(row) : null;
};

const retryOfflineOperation = ({ operationId, resolveConflicts = true }) => {
  if (!operationId || typeof operationId !== 'string') {
    throw new Error('operationId invalido para reenfileirar operacao offline.');
  }

  const db = getOfflineDb();
  const retriedAt = nowIso();

  db.prepare(`
    UPDATE offline_sync_queue
    SET status = 'pending',
        last_error = NULL,
        synced_at = NULL,
        updated_at = ?
    WHERE id = ?
  `).run(retriedAt, operationId);

  if (resolveConflicts) {
    db.prepare(`
      UPDATE offline_sync_conflicts
      SET resolved_at = COALESCE(resolved_at, ?)
      WHERE operation_id = ?
        AND resolved_at IS NULL
    `).run(retriedAt, operationId);
  }

  const queueRow = db.prepare(`
    SELECT *
    FROM offline_sync_queue
    WHERE id = ?
  `).get(operationId);
  const conflictRows = db.prepare(`
    SELECT *
    FROM offline_sync_conflicts
    WHERE operation_id = ?
    ORDER BY created_at DESC
  `).all(operationId);

  return {
    queueItem: queueRow ? mapQueueRow(queueRow) : null,
    conflicts: conflictRows.map(mapConflictRow),
  };
};

const cleanupOfflineData = ({ ownerUserId } = {}) => {
  const db = getOfflineDb();
  return cleanupOfflineDataWithDb(db, { ownerUserId });
};

const getOfflineStatus = ({ ownerUserId }) => {
  if (!ownerUserId || typeof ownerUserId !== 'string') {
    throw new Error('ownerUserId invalido para leitura do status offline.');
  }

  const db = getOfflineDb();
  cleanupOfflineDataWithDb(db, { ownerUserId });
  const queueCounts = db.prepare(`
    SELECT status, count(*) AS total
    FROM offline_sync_queue
    WHERE owner_user_id = ?
    GROUP BY status
  `).all(ownerUserId);
  const conflictsRow = db.prepare(`
    SELECT count(*) AS total
    FROM offline_sync_conflicts
    WHERE owner_user_id = ?
  `).get(ownerUserId);
  const snapshotRow = db.prepare(`
    SELECT updated_at
    FROM store_snapshots
    WHERE owner_user_id = ?
  `).get(ownerUserId);

  const counts = Object.fromEntries(
    queueCounts.map((row) => [row.status, Number(row.total || 0)]),
  );

  return {
    pendingCount: counts.pending || 0,
    processingCount: counts.processing || 0,
    syncedCount: counts.synced || 0,
    conflictCount: counts.conflict || 0,
    recordedConflictCount: Number(conflictsRow?.total || 0),
    snapshotUpdatedAt: snapshotRow?.updated_at || null,
    runtime: {
      appVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      databasePath: getOfflineDbPath(),
      updateChannel: getUpdateChannel(),
    },
  };
};

const printHtml = async (html) => {
  if (!html || typeof html !== 'string') {
    return {
      success: false,
      error: 'Conteudo de impressao invalido.',
    };
  }

  const printWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
    },
  });

  const cleanup = () => {
    if (!printWindow.isDestroyed()) {
      printWindow.close();
    }
  };

  try {
    await new Promise((resolve, reject) => {
      printWindow.webContents.once('did-finish-load', resolve);
      printWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
        reject(new Error(errorDescription || `Falha ao carregar o cupom (${errorCode}).`));
      });
      void printWindow.loadURL(`data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`);
    });

    await new Promise(resolve => setTimeout(resolve, 150));

    const printers = await printWindow.webContents.getPrintersAsync();
    const { configuredPrinterName, selectedPrinter, configuredPrinterMissing } = resolvePrinterSelection(printers);
    const { pageSize, saleId, measuredHeightPixels, estimatedPageCount } = await getReceiptPrintDetails(printWindow);

    appendPrintLog('print-requested', {
      saleId,
      printerName: selectedPrinter?.name || 'system-default',
      displayName: selectedPrinter?.displayName || 'Impressora padrao do sistema',
      configuredPrinterName,
      configuredPrinterMissing,
      availablePrinters: printers.map(printer => printer.name),
      measuredHeightPixels,
      estimatedPageCount,
      pageSize,
    });

    const result = await new Promise((resolve) => {
      printWindow.webContents.print(
        {
          silent: true,
          ...(selectedPrinter ? { deviceName: selectedPrinter.name } : {}),
          printBackground: true,
          color: false,
          copies: 1,
          margins: { marginType: 'none' },
          pageSize,
        },
        (success, failureReason) => {
          resolve({
            success,
            error: success ? null : (failureReason || 'Nao foi possivel enviar o cupom para a impressora padrao.'),
          });
        },
      );
    });

    appendPrintLog(result.success ? 'print-sent' : 'print-failed', {
      saleId,
      printerName: selectedPrinter?.name || 'system-default',
      error: result.error,
    });
    if (result.success) {
      // Chromium can invoke the callback before CUPS/Windows finishes creating
      // the spool job. Keep the hidden window alive so the driver can consume it.
      setTimeout(() => {
        cleanup();
        appendPrintLog('print-window-released', { saleId });
      }, 5000);
    } else {
      cleanup();
    }
    return result;
  } catch (error) {
    appendPrintLog('print-exception', {
      error: error instanceof Error ? error.message : String(error),
    });
    cleanup();
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel preparar o cupom para impressao.',
    };
  }
};

const getUpdateChannel = () => {
  const configuredChannel = process.env.HAPPYCASH_UPDATE_CHANNEL?.trim().toLowerCase();

  if (configuredChannel && VALID_UPDATE_CHANNELS.has(configuredChannel)) {
    return configuredChannel;
  }

  const version = app.getVersion().toLowerCase();

  if (version.includes('-alpha')) {
    return 'alpha';
  }

  if (version.includes('-beta')) {
    return 'beta';
  }

  return 'latest';
};

app.setName(APP_DISPLAY_NAME);

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

const checkForUpdates = async (options = {}) => {
  const shouldAutoInstallOnDownloaded = Boolean(options?.autoInstallOnDownloaded);

  if (isDevelopment) {
    return setUpdateState({
      status: 'disabled',
      channel: getUpdateChannel(),
      availableVersion: null,
      downloadedVersion: null,
      downloadedFile: null,
      manualDownloadUrl: null,
      installStartedAt: null,
      checkedAt: nowIso(),
      error: null,
    });
  }

  autoInstallDownloadedUpdate = shouldAutoInstallOnDownloaded;
  clearPendingUpdateInstall();
  clearPendingUpdateInstallWatchdog();
  clearPendingUpdateForceQuit();
  updateInstallAttemptCount = 0;
  installingDownloadedUpdate = false;

  setUpdateState({
    status: 'checking',
    channel: getUpdateChannel(),
    availableVersion: null,
    downloadedVersion: null,
    downloadedFile: null,
    manualDownloadUrl: getManualUpdateUrl(null),
    installStartedAt: null,
    progress: null,
    bytesPerSecond: null,
    transferred: null,
    total: null,
    checkedAt: nowIso(),
    error: null,
  });

  try {
    await autoUpdater.checkForUpdates();
    if (shouldAutoInstallOnDownloaded && getUpdateState().status === 'downloaded') {
      scheduleDownloadedUpdateInstall('preflight-check');
    }
    return getUpdateState();
  } catch (error) {
    console.error('Erro ao procurar atualizacoes automáticas:', error);
    const errorMessage = error instanceof Error ? error.message : 'Falha ao procurar atualizacoes.';
    if (isReleaseMetadataPublishingError(errorMessage)) {
      return scheduleUpdateMetadataRetry(errorMessage);
    }
    return setUpdateState({
      status: 'error',
      manualDownloadUrl: getManualUpdateUrl(updateState.availableVersion),
      checkedAt: nowIso(),
      error: errorMessage,
    });
  }
};

const setupAutoUpdates = (mainWindow) => {
  const updateChannel = getUpdateChannel();

  if (isDevelopment) {
    setUpdateState({
      status: 'disabled',
      channel: updateChannel,
      availableVersion: null,
      downloadedVersion: null,
      downloadedFile: null,
      manualDownloadUrl: null,
      installStartedAt: null,
      error: null,
    });
    return;
  }

  if (autoUpdatesConfigured) return;
  autoUpdatesConfigured = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.channel = updateChannel;
  autoUpdater.allowPrerelease = updateChannel !== 'latest';
  autoUpdater.allowDowngrade = updateChannel !== 'latest';
  setUpdateState({
    status: 'idle',
    channel: updateChannel,
    manualDownloadUrl: getManualUpdateUrl(null),
    installStartedAt: null,
    error: null,
  });

  console.log(`Canal de atualizacao configurado: ${updateChannel}`);

  autoUpdater.on('checking-for-update', () => {
    console.log(`Verificando atualizacoes do ${APP_DISPLAY_NAME}...`);
    clearPendingUpdateRetry();
    clearPendingUpdateInstall();
    clearPendingUpdateInstallWatchdog();
    clearPendingUpdateForceQuit();
    updateInstallAttemptCount = 0;
    installingDownloadedUpdate = false;
    setUpdateState({
      status: 'checking',
      availableVersion: null,
      downloadedVersion: null,
      downloadedFile: null,
      manualDownloadUrl: getManualUpdateUrl(null),
      installStartedAt: null,
      progress: null,
      bytesPerSecond: null,
      transferred: null,
      total: null,
      checkedAt: nowIso(),
      error: null,
    });
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`Atualizacao ${info?.version || ''} encontrada. Baixando em segundo plano...`);
    clearPendingUpdateRetry();
    clearPendingUpdateInstall();
    clearPendingUpdateInstallWatchdog();
    clearPendingUpdateForceQuit();
    updateInstallAttemptCount = 0;
    installingDownloadedUpdate = false;
    setUpdateState({
      status: 'downloading',
      availableVersion: info?.version || null,
      downloadedVersion: null,
      downloadedFile: null,
      manualDownloadUrl: getManualUpdateUrl(info?.version || null),
      installStartedAt: null,
      progress: 0,
      bytesPerSecond: null,
      transferred: null,
      total: null,
      checkedAt: nowIso(),
      error: null,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      progress: Number.isFinite(progress?.percent) ? Math.max(0, Math.min(100, progress.percent)) : null,
      bytesPerSecond: Number.isFinite(progress?.bytesPerSecond) ? progress.bytesPerSecond : null,
      transferred: Number.isFinite(progress?.transferred) ? progress.transferred : null,
      total: Number.isFinite(progress?.total) ? progress.total : null,
      checkedAt: nowIso(),
      error: null,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('Nenhuma atualizacao nova encontrada.');
    clearPendingUpdateRetry();
    clearPendingUpdateInstall();
    clearPendingUpdateInstallWatchdog();
    clearPendingUpdateForceQuit();
    autoInstallDownloadedUpdate = false;
    updateInstallAttemptCount = 0;
    installingDownloadedUpdate = false;
    setUpdateState({
      status: 'idle',
      availableVersion: null,
      downloadedVersion: null,
      downloadedFile: null,
      manualDownloadUrl: getManualUpdateUrl(null),
      installStartedAt: null,
      progress: null,
      bytesPerSecond: null,
      transferred: null,
      total: null,
      checkedAt: nowIso(),
      error: null,
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('Falha no auto-update:', error);
    const currentState = getUpdateState();
    const errorMessage = error instanceof Error ? error.message : 'Falha no auto-update.';

    if (isReleaseMetadataPublishingError(errorMessage)) {
      scheduleUpdateMetadataRetry(errorMessage);
      return;
    }

    if (currentState.status === 'downloaded') {
      setUpdateState({
        checkedAt: nowIso(),
        error: errorMessage,
      });
      return;
    }

    clearPendingUpdateInstall();
    clearPendingUpdateInstallWatchdog();
    clearPendingUpdateForceQuit();
    autoInstallDownloadedUpdate = false;
    updateInstallAttemptCount = 0;
    installingDownloadedUpdate = false;

    setUpdateState({
      status: 'error',
      downloadedVersion: null,
      downloadedFile: null,
      manualDownloadUrl: getManualUpdateUrl(currentState.availableVersion),
      installStartedAt: null,
      checkedAt: nowIso(),
      error: errorMessage,
    });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const downloadedVersion = info?.version || updateState.availableVersion || null;
    clearPendingUpdateRetry();
    setUpdateState({
      status: 'downloaded',
      availableVersion: downloadedVersion,
      downloadedVersion,
      downloadedFile: info?.downloadedFile || null,
      manualDownloadUrl: getManualUpdateUrl(downloadedVersion),
      installStartedAt: null,
      progress: 100,
      bytesPerSecond: null,
      transferred: null,
      total: null,
      checkedAt: nowIso(),
      error: null,
    });

    if (autoInstallDownloadedUpdate) {
      scheduleDownloadedUpdateInstall('update-downloaded');
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
    clearPendingUpdateRetry();
    clearPendingUpdateInstall();
    clearPendingUpdateInstallWatchdog();
    clearPendingUpdateForceQuit();
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
    paintWhenInitiallyHidden: true,
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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

  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow.isDestroyed()) return;
    mainWindow.show();
  });

  const rendererEntry = resolveRendererEntry();
  if (rendererEntry.startsWith('http://') || rendererEntry.startsWith('https://')) {
    await mainWindow.loadURL(rendererEntry);
    return mainWindow;
  }

  await mainWindow.loadFile(rendererEntry);
  return mainWindow;
};

ipcMain.on('open-external-url', (event, url) => {
  if (!isHttpUrl(url)) {
    event.returnValue = false;
    return;
  }

  shell.openExternal(url);
  event.returnValue = true;
});

ipcMain.handle('turnstile:request', (_event, payload) => (
  requestDesktopTurnstileToken({
    action: payload?.action,
    appOrigin: HAPPYCASH_APP_ORIGIN,
    openExternal: url => shell.openExternal(url),
    timeoutMs: DESKTOP_TURNSTILE_TIMEOUT_MS,
  })
));

ipcMain.handle('print-html', async (_event, html) => {
  return printHtml(html);
});

ipcMain.handle('fiscal:archive-document', async (_event, payload) => archiveFiscalDocument(payload));

ipcMain.handle('printer:list', async (event) => {
  const printers = await event.sender.getPrintersAsync();
  const { configuredPrinterName, selectedPrinter } = resolvePrinterSelection(printers);
  const defaultPrinter = printers.find(isDefaultPrinter)
    || (printers.length === 1 ? selectedPrinter : null);
  return {
    selectedName: configuredPrinterName,
    defaultName: defaultPrinter?.name || null,
    printers: printers.map(printer => ({
      name: printer.name,
      displayName: printer.displayName || printer.name,
      description: printer.description || '',
      isDefault: isDefaultPrinter(printer),
    })),
  };
});

ipcMain.handle('printer:select', (_event, printerName) => {
  try {
    return { success: true, selectedName: writeSelectedPrinterName(printerName) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel salvar a impressora.',
    };
  }
});

ipcMain.handle('printer:test', async () => printHtml(`
  <!doctype html>
  <html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    @page { size: auto; margin: 0; }
    body { width: 80mm; margin: 0; font-family: Arial, sans-serif; text-align: center; font-size: 15px; font-weight: 600; }
    main { width: 80mm; padding: 9mm 3mm 5mm; }
    strong { display: block; font-size: 21px; margin-bottom: 8px; }
  </style></head><body>
    <main data-receipt-root>
      <strong>HappyCash</strong>
      <div>Teste de impressao concluido</div>
      <div>${new Date().toLocaleString('pt-BR')}</div>
    </main>
  </body></html>
`));

ipcMain.handle('app:get-runtime-info', () => getRuntimeInfo());

ipcMain.on('app:get-runtime-info-sync', (event) => {
  event.returnValue = getRuntimeInfo();
});

ipcMain.handle('app:get-update-status', () => {
  return getUpdateState();
});

ipcMain.handle('app:check-for-updates', async (_event, options) => {
  return checkForUpdates(options || {});
});

ipcMain.handle('app:install-update', () => {
  return startDownloadedUpdateInstall('ipc');
});

ipcMain.handle('app:open-update-download', async () => {
  const state = getUpdateState();
  const url = state.manualDownloadUrl || getManualUpdateUrl(state.availableVersion || state.downloadedVersion);
  await shell.openExternal(url);
  return { success: true, url };
});

ipcMain.handle('offline:replace-snapshot', (_event, payload) => {
  return replaceOfflineSnapshot(payload || {});
});

ipcMain.handle('offline:get-snapshot', (_event, payload) => {
  return getOfflineSnapshot(payload || {});
});

ipcMain.handle('offline:enqueue', (_event, payload) => {
  return enqueueOfflineOperation(payload || {});
});

ipcMain.handle('offline:list-queue', (_event, payload) => {
  return listOfflineQueue(payload || {});
});

ipcMain.handle('offline:update-queue-item', (_event, payload) => {
  return updateOfflineQueueItem(payload || {});
});

ipcMain.handle('offline:record-conflict', (_event, payload) => {
  return recordOfflineConflict(payload || {});
});

ipcMain.handle('offline:list-conflicts', (_event, payload) => {
  return listOfflineConflicts(payload || {});
});

ipcMain.handle('offline:resolve-conflict', (_event, payload) => {
  return resolveOfflineConflict(payload || {});
});

ipcMain.handle('offline:retry-operation', (_event, payload) => {
  return retryOfflineOperation(payload || {});
});

ipcMain.handle('offline:cleanup-data', (_event, payload) => {
  return cleanupOfflineData(payload || {});
});

ipcMain.handle('offline:get-status', (_event, payload) => {
  return getOfflineStatus(payload || {});
});

app.whenReady().then(() => {
  try {
    getOfflineDb();
  } catch (error) {
    console.error('Erro ao iniciar banco offline do desktop:', error);
  }

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
  if (installingDownloadedUpdate || process.platform !== 'darwin') {
    app.quit();
  }
});
