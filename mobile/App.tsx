import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const appContext = runtimeEnv.EXPO_PUBLIC_HAPPYCASH_CONTEXT?.trim().toLowerCase() === 'happycashfood'
  ? 'happycashfood'
  : 'happycash';
const productLabel = appContext === 'happycashfood' ? 'HappyCashFood Mobile' : 'HappyCash Mobile';
const productShortLabel = appContext === 'happycashfood' ? 'HappyCashFood' : 'HappyCash';
const defaultPublicSystemUrl = appContext === 'happycashfood'
  ? 'https://food.happycashsite.com.br'
  : 'https://app.happycashsite.com.br';
const envConfiguredUrl = runtimeEnv.EXPO_PUBLIC_HAPPYCASH_WEB_URL?.trim() || '';
const envSuggestedDevUrl = runtimeEnv.EXPO_PUBLIC_HAPPYCASH_DEV_URL?.trim() || '';

const normalizeUrl = (value: string) => value.trim();

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function App() {
  const initialActiveUrl = isValidHttpUrl(envConfiguredUrl) ? normalizeUrl(envConfiguredUrl) : defaultPublicSystemUrl;
  const [draftUrl, setDraftUrl] = useState(envConfiguredUrl || envSuggestedDevUrl || defaultPublicSystemUrl);
  const [activeUrl, setActiveUrl] = useState(initialActiveUrl);
  const [showConfig, setShowConfig] = useState(false);
  const [loadError, setLoadError] = useState('');

  const canLoadDraft = isValidHttpUrl(draftUrl);

  const handleApplyUrl = () => {
    if (!canLoadDraft) return;

    setActiveUrl(normalizeUrl(draftUrl));
    setLoadError('');
    setShowConfig(false);
  };

  const handleOpenExternally = async () => {
    if (!activeUrl || !isValidHttpUrl(activeUrl)) return;
    await Linking.openURL(activeUrl);
  };

  const renderConfig = () => (
    <ScrollView contentContainerStyle={styles.configScrollContent}>
      <View style={styles.card}>
        <Text style={styles.title}>{productLabel}</Text>
        <Text style={styles.subtitle}>
          Este app Expo carrega a versao web do {productShortLabel} dentro de um WebView para testar Android sem misturar a release mobile do Food com a do HappyCash principal.
        </Text>

        <View style={styles.quickActions}>
          <Pressable style={[styles.quickButton, styles.quickButtonPrimary]} onPress={() => setDraftUrl(defaultPublicSystemUrl)}>
            <Text style={styles.quickButtonPrimaryText}>Usar sistema publico</Text>
          </Pressable>
          <Pressable
            style={styles.quickButton}
            onPress={() => envSuggestedDevUrl && setDraftUrl(envSuggestedDevUrl)}
            disabled={!envSuggestedDevUrl}
          >
            <Text style={[styles.quickButtonText, !envSuggestedDevUrl && styles.quickButtonTextDisabled]}>
              URL local sugerida
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>URL do {productShortLabel}</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://seu-endereco-ou-ip"
          placeholderTextColor="#7c89a5"
          style={styles.input}
          value={draftUrl}
          onChangeText={setDraftUrl}
        />

        <Text style={styles.help}>
          Para testar o sistema local no celular, rode o frontend na mesma rede e informe algo como
          {' '}<Text style={styles.helpStrong}>http://SEU-IP:8080</Text>.
        </Text>

        {!canLoadDraft && draftUrl.trim().length > 0 && (
          <Text style={styles.errorText}>Informe uma URL valida com http:// ou https://</Text>
        )}

        <Pressable
          style={[styles.actionButton, !canLoadDraft && styles.actionButtonDisabled]}
          disabled={!canLoadDraft}
          onPress={handleApplyUrl}
        >
          <Text style={styles.actionButtonText}>Abrir {productShortLabel}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        {showConfig || !activeUrl ? (
          renderConfig()
        ) : (
          <>
            <View style={styles.topBar}>
              <View style={styles.topBarTextGroup}>
                <Text style={styles.topBarTitle}>{productShortLabel}</Text>
                <Text style={styles.topBarUrl} numberOfLines={1}>{activeUrl}</Text>
              </View>

              <View style={styles.topBarActions}>
                <Pressable style={styles.secondaryButton} onPress={() => setShowConfig(true)}>
                  <Text style={styles.secondaryButtonText}>URL</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void handleOpenExternally()}>
                  <Text style={styles.secondaryButtonText}>Abrir fora</Text>
                </Pressable>
              </View>
            </View>

            {loadError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>Nao foi possivel abrir a URL informada.</Text>
                <Text style={styles.errorText}>{loadError}</Text>
                <Pressable style={styles.actionButton} onPress={() => setShowConfig(true)}>
                  <Text style={styles.actionButtonText}>Trocar URL</Text>
                </Pressable>
              </View>
            ) : (
              <WebView
                source={{ uri: activeUrl }}
                style={styles.webview}
                startInLoadingState
                setSupportMultipleWindows={false}
                onError={(event) => {
                  setLoadError(event.nativeEvent.description || 'Falha ao carregar o HappyCash.');
                }}
                renderLoading={() => (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ffcc00" />
                    <Text style={styles.loadingText}>Carregando {productShortLabel}...</Text>
                  </View>
                )}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070d',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#182033',
    backgroundColor: '#0b1020',
  },
  topBarTextGroup: {
    flex: 1,
  },
  topBarTitle: {
    color: '#f4f7ff',
    fontSize: 18,
    fontWeight: '700',
  },
  topBarUrl: {
    marginTop: 2,
    color: '#93a1c0',
    fontSize: 12,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#131c2f',
    borderWidth: 1,
    borderColor: '#24304b',
  },
  secondaryButtonText: {
    color: '#d9e3ff',
    fontSize: 13,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: '#05070d',
  },
  configScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e2940',
    backgroundColor: '#0b1020',
    padding: 20,
  },
  title: {
    color: '#f7f8fc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 10,
    color: '#a6b2ce',
    fontSize: 15,
    lineHeight: 22,
  },
  quickActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  quickButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#24304b',
    backgroundColor: '#131c2f',
  },
  quickButtonPrimary: {
    backgroundColor: '#ffcc00',
    borderColor: '#ffcc00',
  },
  quickButtonPrimaryText: {
    color: '#101217',
    fontSize: 14,
    fontWeight: '700',
  },
  quickButtonText: {
    color: '#dbe4ff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickButtonTextDisabled: {
    color: '#66728d',
  },
  label: {
    marginTop: 22,
    marginBottom: 8,
    color: '#eef2ff',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#24304b',
    backgroundColor: '#10172a',
    color: '#f5f7fc',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  help: {
    marginTop: 12,
    color: '#8f9bb7',
    fontSize: 13,
    lineHeight: 19,
  },
  helpStrong: {
    color: '#ffffff',
    fontWeight: '700',
  },
  actionButton: {
    marginTop: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#ffcc00',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: '#101217',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05070d',
    gap: 12,
  },
  loadingText: {
    color: '#dbe4ff',
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    color: '#ff9c9c',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
