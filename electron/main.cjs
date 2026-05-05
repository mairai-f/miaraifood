const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const UPDATE_CHECK_DELAY_MS = 15_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_METADATA_RETRY_DELAY_MS = 60_000;
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;
let autoUpdatesConfigured = false;
const APP_USER_MODEL_ID = 'com.happycash.desktop';
const HAPPYCASH_SITE_ORIGIN = (process.env.HAPPYCASH_SITE_ORIGIN || 'https://www.happycashsite.com.br').replace(/\/+$/, '');
const VALID_UPDATE_CHANNELS = new Set(['latest', 'beta', 'alpha']);
const OFFLINE_DB_FILENAME = 'happycash-concentrator.sqlite';
const OFFLINE_DB_SCHEMA_VERSION = 3;
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

const sha256Hex = (value) => require('crypto').createHash('sha256').update(String(value || '')).digest('hex');

const hashPin = (pin, salt = null) => {
  const crypto = require('crypto');
  const resolvedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(pin || ''), resolvedSalt, 120_000, 32, 'sha256').toString('hex');
  return { salt: resolvedSalt, hash };
};

const encryptLocalPayload = (payload) => {
  const raw = Buffer.from(JSON.stringify(payload || {}), 'utf8');
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      value: safeStorage.encryptString(raw.toString('utf8')).toString('base64'),
    };
  }

  return {
    encrypted: false,
    value: raw.toString('base64'),
  };
};

const decryptLocalPayload = (row) => {
  if (!row?.encrypted_license) return null;

  try {
    const buffer = Buffer.from(row.encrypted_license, 'base64');
    const json = row.license_encrypted
      ? safeStorage.decryptString(buffer)
      : buffer.toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
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

const isReleaseMetadataPublishingError = (errorMessage) =>
  /Cannot find latest(?:-[\w]+)?\.yml in the latest release artifacts/i.test(errorMessage);

const scheduleUpdateMetadataRetry = (errorMessage) => {
  clearPendingUpdateRetry();

  const friendlyMessage = 'A nova release ainda esta sendo publicada. O HappyCash vai tentar novamente automaticamente em instantes.';
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

    CREATE TABLE IF NOT EXISTS desktop_activation (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      owner_user_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      admin_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      license_key_hash TEXT NOT NULL,
      license_key_suffix TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      valid_until TEXT,
      offline_grace_until TEXT,
      offline_grace_days INTEGER NOT NULL DEFAULT 7,
      encrypted_license TEXT NOT NULL,
      license_encrypted INTEGER NOT NULL DEFAULT 0,
      activated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
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

const getActivationStatusWithDb = (db) => {
  const row = db.prepare(`
    SELECT *
    FROM desktop_activation
    WHERE id = 1
  `).get();

  if (!row) {
    return {
      activated: false,
      expired: false,
      activation: null,
    };
  }

  const now = Date.now();
  const graceUntilMs = row.offline_grace_until ? new Date(row.offline_grace_until).getTime() : Number.POSITIVE_INFINITY;
  const expired = Number.isFinite(graceUntilMs) && graceUntilMs <= now;

  return {
    activated: !expired,
    expired,
    activation: {
      ownerUserId: row.owner_user_id,
      adminEmail: row.admin_email,
      adminName: row.admin_name,
      licenseKeySuffix: row.license_key_suffix,
      planId: row.plan_id,
      validUntil: row.valid_until || null,
      offlineGraceUntil: row.offline_grace_until || null,
      offlineGraceDays: Number(row.offline_grace_days || 7),
      activatedAt: row.activated_at,
      license: decryptLocalPayload(row),
    },
  };
};

const saveActivationWithDb = (db, payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Dados de ativacao invalidos.');
  }

  const ownerUserId = String(payload.ownerUserId || '').trim();
  const adminEmail = String(payload.adminEmail || '').trim().toLowerCase();
  const adminName = String(payload.adminName || '').trim();
  const pin = String(payload.pin || '');
  const licenseKey = String(payload.licenseKey || '').trim().toUpperCase();
  const planId = String(payload.planId || 'pro').trim();

  if (!ownerUserId || !adminEmail || !adminName || !licenseKey) {
    throw new Error('Ativacao incompleta.');
  }

  if (!/^\d{4,12}$/.test(pin)) {
    throw new Error('PIN local deve ter de 4 a 12 numeros.');
  }

  const pinResult = hashPin(pin);
  const encrypted = encryptLocalPayload({
    ownerUserId,
    adminEmail,
    adminName,
    licenseKey,
    planId,
    validUntil: payload.validUntil || null,
    offlineGraceUntil: payload.offlineGraceUntil || null,
    offlineGraceDays: Number(payload.offlineGraceDays || 7),
    savedAt: nowIso(),
  });

  db.prepare(`
    INSERT INTO desktop_activation (
      id,
      owner_user_id,
      admin_email,
      admin_name,
      pin_hash,
      pin_salt,
      license_key_hash,
      license_key_suffix,
      plan_id,
      valid_until,
      offline_grace_until,
      offline_grace_days,
      encrypted_license,
      license_encrypted,
      activated_at,
      updated_at
    )
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      owner_user_id = excluded.owner_user_id,
      admin_email = excluded.admin_email,
      admin_name = excluded.admin_name,
      pin_hash = excluded.pin_hash,
      pin_salt = excluded.pin_salt,
      license_key_hash = excluded.license_key_hash,
      license_key_suffix = excluded.license_key_suffix,
      plan_id = excluded.plan_id,
      valid_until = excluded.valid_until,
      offline_grace_until = excluded.offline_grace_until,
      offline_grace_days = excluded.offline_grace_days,
      encrypted_license = excluded.encrypted_license,
      license_encrypted = excluded.license_encrypted,
      updated_at = excluded.updated_at
  `).run(
    ownerUserId,
    adminEmail,
    adminName,
    pinResult.hash,
    pinResult.salt,
    sha256Hex(licenseKey),
    licenseKey.slice(-4),
    planId,
    payload.validUntil || null,
    payload.offlineGraceUntil || null,
    Number(payload.offlineGraceDays || 7),
    encrypted.value,
    encrypted.encrypted ? 1 : 0,
    nowIso(),
    nowIso(),
  );

  return getActivationStatusWithDb(db);
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

    const result = await new Promise((resolve) => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
        },
        (success, failureReason) => {
          resolve({
            success,
            error: success ? null : (failureReason || 'Nao foi possivel enviar o cupom para a impressora padrao.'),
          });
        },
      );
    });

    cleanup();
    return result;
  } catch (error) {
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

app.setName('HappyCash');

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

const checkForUpdates = async () => {
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
    console.log('Verificando atualizacoes do HappyCash...');
    clearPendingUpdateRetry();
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

ipcMain.handle('print-html', async (_event, html) => {
  return printHtml(html);
});

ipcMain.handle('app:get-runtime-info', () => ({
  appVersion: app.getVersion(),
  isPackaged: app.isPackaged,
  platform: process.platform,
  databasePath: getOfflineDbPath(),
  updateChannel: getUpdateChannel(),
}));

ipcMain.handle('app:get-update-status', () => {
  return getUpdateState();
});

ipcMain.handle('app:check-for-updates', async () => {
  return checkForUpdates();
});

ipcMain.handle('app:install-update', () => {
  const state = getUpdateState();
  if (state.status !== 'downloaded') {
    return { success: false, error: 'Nenhuma atualizacao baixada para instalar.' };
  }

  try {
    setUpdateState({
      status: 'installing',
      installStartedAt: nowIso(),
      error: null,
    });

    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (error) {
        console.error('Falha ao iniciar instalacao da atualizacao:', error);
        setUpdateState({
          status: 'error',
          installStartedAt: null,
          manualDownloadUrl: getManualUpdateUrl(state.downloadedVersion || state.availableVersion),
          checkedAt: nowIso(),
          error: error instanceof Error ? error.message : 'Falha ao iniciar instalacao da atualizacao.',
        });
      }
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Falha ao iniciar instalacao da atualizacao.',
    };
  }
});

ipcMain.handle('app:open-update-download', async () => {
  const state = getUpdateState();
  const url = state.manualDownloadUrl || getManualUpdateUrl(state.availableVersion || state.downloadedVersion);
  await shell.openExternal(url);
  return { success: true, url };
});

ipcMain.handle('activation:get-status', () => {
  try {
    return getActivationStatusWithDb(getOfflineDb());
  } catch (error) {
    return {
      activated: false,
      expired: false,
      activation: null,
      error: error instanceof Error ? error.message : 'Nao foi possivel ler a ativacao local.',
    };
  }
});

ipcMain.handle('activation:activate', (_event, payload) => {
  try {
    return {
      success: true,
      ...saveActivationWithDb(getOfflineDb(), payload),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel salvar a ativacao local.',
    };
  }
});

ipcMain.handle('activation:clear', () => {
  try {
    getOfflineDb().prepare('DELETE FROM desktop_activation WHERE id = 1').run();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Nao foi possivel limpar a ativacao local.',
    };
  }
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
