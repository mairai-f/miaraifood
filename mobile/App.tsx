import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const productShortLabel = 'HappyCash';
const defaultPublicSystemUrl = 'https://app.happycashsite.com.br';
const envConfiguredUrl = runtimeEnv.EXPO_PUBLIC_HAPPYCASH_WEB_URL?.trim() || '';

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const activeUrl = isValidHttpUrl(envConfiguredUrl) ? envConfiguredUrl : defaultPublicSystemUrl;

const mobileRuntimeBridge = String.raw`
(function () {
  if (window.happyCashMobileAPI) return true;

  var appVersion = '0.1.61';
  var snapshotPrefix = 'happycash:mobile:offline:snapshot:';
  var queuePrefix = 'happycash:mobile:offline:queue:';
  var conflictPrefix = 'happycash:mobile:offline:conflicts:';

  var nowIso = function () {
    return new Date().toISOString();
  };

  var randomId = function (prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  };

  var readJson = function (key, fallbackValue) {
    try {
      var stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : fallbackValue;
    } catch (_error) {
      return fallbackValue;
    }
  };

  var writeJson = function (key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  var snapshotKey = function (ownerUserId) {
    return snapshotPrefix + ownerUserId;
  };

  var queueKey = function (ownerUserId) {
    return queuePrefix + ownerUserId;
  };

  var conflictKey = function (ownerUserId) {
    return conflictPrefix + ownerUserId;
  };

  var readQueue = function (ownerUserId) {
    return readJson(queueKey(ownerUserId), []);
  };

  var writeQueue = function (ownerUserId, items) {
    writeJson(queueKey(ownerUserId), Array.isArray(items) ? items : []);
  };

  var readConflicts = function (ownerUserId) {
    return readJson(conflictKey(ownerUserId), []);
  };

  var writeConflicts = function (ownerUserId, items) {
    writeJson(conflictKey(ownerUserId), Array.isArray(items) ? items : []);
  };

  var findQueueOwner = function (id) {
    for (var index = 0; index < window.localStorage.length; index += 1) {
      var key = window.localStorage.key(index);
      if (!key || key.indexOf(queuePrefix) !== 0) continue;
      var ownerUserId = key.slice(queuePrefix.length);
      var queue = readQueue(ownerUserId);
      if (queue.some(function (item) { return item.id === id; })) {
        return ownerUserId;
      }
    }
    return null;
  };

  var findConflictOwner = function (id) {
    for (var index = 0; index < window.localStorage.length; index += 1) {
      var key = window.localStorage.key(index);
      if (!key || key.indexOf(conflictPrefix) !== 0) continue;
      var ownerUserId = key.slice(conflictPrefix.length);
      var conflicts = readConflicts(ownerUserId);
      if (conflicts.some(function (item) { return item.id === id; })) {
        return ownerUserId;
      }
    }
    return null;
  };

  var getRuntimeInfo = function () {
    return {
      appVersion: appVersion,
      isPackaged: true,
      platform: 'android',
      databasePath: 'android-local-storage',
      updateChannel: 'mobile',
      productContext: 'happycash',
      installerToken: null
    };
  };

  window.happyCashMobileAPI = {
    app: {
      getRuntimeInfo: function () {
        return Promise.resolve(getRuntimeInfo());
      },
      getRuntimeInfoSync: getRuntimeInfo
    },
    offline: {
      replaceSnapshot: function (payload) {
        var ownerUserId = payload && payload.ownerUserId;
        if (!ownerUserId) return Promise.reject(new Error('ownerUserId invalido para snapshot offline.'));
        var updatedAt = nowIso();
        writeJson(snapshotKey(ownerUserId), {
          snapshot: payload.snapshot || null,
          updatedAt: updatedAt
        });
        return Promise.resolve({ success: true, updatedAt: updatedAt });
      },
      getSnapshot: function (payload) {
        var ownerUserId = payload && payload.ownerUserId;
        if (!ownerUserId) return Promise.reject(new Error('ownerUserId invalido para leitura do snapshot offline.'));
        var stored = readJson(snapshotKey(ownerUserId), null);
        return Promise.resolve({
          snapshot: stored ? stored.snapshot : null,
          updatedAt: stored ? stored.updatedAt : null
        });
      },
      enqueue: function (payload) {
        var ownerUserId = payload && payload.ownerUserId;
        var operationType = payload && payload.operationType;
        if (!ownerUserId || !operationType) return Promise.reject(new Error('Fila offline invalida.'));
        var createdAt = nowIso();
        var item = {
          id: randomId('offline'),
          ownerUserId: ownerUserId,
          operationType: operationType,
          payload: payload.payload || null,
          status: 'pending',
          lastError: null,
          attemptCount: 0,
          createdAt: createdAt,
          updatedAt: createdAt,
          syncedAt: null
        };
        var queue = readQueue(ownerUserId);
        queue.push(item);
        writeQueue(ownerUserId, queue);
        return Promise.resolve(item);
      },
      listQueue: function (payload) {
        var ownerUserId = payload && payload.ownerUserId;
        if (!ownerUserId) return Promise.reject(new Error('ownerUserId invalido para leitura da fila offline.'));
        var statuses = Array.isArray(payload.statuses) ? payload.statuses : [];
        var queue = readQueue(ownerUserId);
        if (statuses.length === 0) return Promise.resolve(queue);
        return Promise.resolve(queue.filter(function (item) {
          return statuses.indexOf(item.status) !== -1;
        }));
      },
      updateQueueItem: function (payload) {
        var id = payload && payload.id;
        var ownerUserId = id ? findQueueOwner(id) : null;
        if (!ownerUserId) return Promise.resolve(null);
        var queue = readQueue(ownerUserId);
        var updatedItem = null;
        var updatedAt = nowIso();
        queue = queue.map(function (item) {
          if (item.id !== id) return item;
          updatedItem = Object.assign({}, item, {
            status: payload.status || item.status,
            lastError: typeof payload.lastError === 'undefined' ? item.lastError : payload.lastError,
            syncedAt: typeof payload.syncedAt === 'undefined' ? item.syncedAt : payload.syncedAt,
            attemptCount: item.attemptCount + (payload.incrementAttempt ? 1 : 0),
            updatedAt: updatedAt
          });
          return updatedItem;
        });
        writeQueue(ownerUserId, queue);
        return Promise.resolve(updatedItem);
      },
      recordConflict: function (payload) {
        var ownerUserId = payload && payload.ownerUserId;
        var operationId = payload && payload.operationId;
        if (!ownerUserId || !operationId) return Promise.reject(new Error('Conflito offline invalido.'));
        var conflicts = readConflicts(ownerUserId);
        var createdAt = nowIso();
        var existingIndex = conflicts.findIndex(function (item) {
          return item.operationId === operationId && !item.resolvedAt;
        });
        var conflict = {
          id: existingIndex >= 0 ? conflicts[existingIndex].id : randomId('conflict'),
          ownerUserId: ownerUserId,
          operationId: operationId,
          operationType: payload.operationType,
          message: payload.message || 'Conflito offline.',
          payload: payload.payload || null,
          createdAt: createdAt,
          resolvedAt: null
        };
        if (existingIndex >= 0) {
          conflicts[existingIndex] = conflict;
        } else {
          conflicts.push(conflict);
        }
        writeConflicts(ownerUserId, conflicts);
        return Promise.resolve(conflict);
      },
      listConflicts: function (payload) {
        var ownerUserId = payload && payload.ownerUserId;
        if (!ownerUserId) return Promise.reject(new Error('ownerUserId invalido para leitura dos conflitos offline.'));
        return Promise.resolve(readConflicts(ownerUserId).sort(function (left, right) {
          return String(right.createdAt).localeCompare(String(left.createdAt));
        }));
      },
      resolveConflict: function (payload) {
        var id = payload && payload.id;
        var ownerUserId = id ? findConflictOwner(id) : null;
        if (!ownerUserId) return Promise.resolve(null);
        var resolvedAt = payload.resolved === false ? null : nowIso();
        var resolvedConflict = null;
        var conflicts = readConflicts(ownerUserId).map(function (item) {
          if (item.id !== id) return item;
          resolvedConflict = Object.assign({}, item, { resolvedAt: resolvedAt });
          return resolvedConflict;
        });
        writeConflicts(ownerUserId, conflicts);
        return Promise.resolve(resolvedConflict);
      },
      retryOperation: function (payload) {
        var operationId = payload && payload.operationId;
        var ownerUserId = operationId ? findQueueOwner(operationId) : null;
        if (!ownerUserId) return Promise.resolve({ queueItem: null, conflicts: [] });
        var retriedAt = nowIso();
        var queueItem = null;
        var queue = readQueue(ownerUserId).map(function (item) {
          if (item.id !== operationId) return item;
          queueItem = Object.assign({}, item, {
            status: 'pending',
            lastError: null,
            syncedAt: null,
            updatedAt: retriedAt
          });
          return queueItem;
        });
        var conflicts = readConflicts(ownerUserId).map(function (item) {
          if (item.operationId !== operationId || payload.resolveConflicts === false || item.resolvedAt) return item;
          return Object.assign({}, item, { resolvedAt: retriedAt });
        });
        writeQueue(ownerUserId, queue);
        writeConflicts(ownerUserId, conflicts);
        return Promise.resolve({
          queueItem: queueItem,
          conflicts: conflicts.filter(function (item) { return item.operationId === operationId; })
        });
      },
      cleanupData: function (payload) {
        return Promise.resolve({
          deletedSyncedQueueItems: 0,
          deletedResolvedConflicts: 0,
          ownerUserId: payload && payload.ownerUserId
        });
      },
      getStatus: function (payload) {
        var ownerUserId = payload && payload.ownerUserId;
        if (!ownerUserId) return Promise.reject(new Error('ownerUserId invalido para leitura do status offline.'));
        var queue = readQueue(ownerUserId);
        var conflicts = readConflicts(ownerUserId);
        var snapshot = readJson(snapshotKey(ownerUserId), null);
        var countStatus = function (status) {
          return queue.filter(function (item) { return item.status === status; }).length;
        };
        return Promise.resolve({
          pendingCount: countStatus('pending'),
          processingCount: countStatus('processing'),
          syncedCount: countStatus('synced'),
          conflictCount: countStatus('conflict'),
          recordedConflictCount: conflicts.length,
          snapshotUpdatedAt: snapshot ? snapshot.updatedAt : null,
          runtime: getRuntimeInfo()
        });
      }
    }
  };

  return true;
})();
true;
`;

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <WebView
          source={{ uri: activeUrl }}
          style={styles.webview}
          applicationNameForUserAgent="HappyCashAndroid/0.1.61"
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          setSupportMultipleWindows={false}
          injectedJavaScriptBeforeContentLoaded={mobileRuntimeBridge}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1f49b6" />
              <Text style={styles.loadingText}>Carregando {productShortLabel}...</Text>
            </View>
          )}
          renderError={() => (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Nao foi possivel abrir o HappyCash.</Text>
              <Text style={styles.errorText}>
                Conecte a internet para o primeiro acesso. Depois da validacao online, o modo offline local fica disponivel por 24 horas.
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fbff',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f8fbff',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#f8fbff',
  },
  loadingText: {
    color: '#172342',
    fontSize: 15,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fbff',
  },
  errorTitle: {
    color: '#172342',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    color: '#56647d',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
