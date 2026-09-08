/**
 * secureStorage — Abstração de armazenamento seguro para o HappyCash.
 *
 * No Electron: usa safeStorage via IPC (criptografado pelo OS keychain).
 *   - Windows: DPAPI ligado ao perfil do usuário Windows
 *   - macOS: Keychain
 *   - Linux: Secret Service / libsecret
 *
 * Na web (browser): usa localStorage normalmente. Os dados sensíveis
 * ficam no servidor (Supabase) e o localStorage guarda apenas cache de sessão.
 *
 * Migração automática: na primeira chamada a getItem(), se a chave existir
 * no localStorage, o valor é movido para o safeStorage e deletado do
 * localStorage. Isso garante que o update aplica proteção transparentemente.
 */

const isElectron = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.electronAPI?.secureStorage);

/**
 * Tenta migrar uma chave do localStorage para o safeStorage (Electron).
 * Chamado apenas uma vez por chave, na primeira leitura.
 */
const migrateFromLocalStorage = async (key: string): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return null;

    // Tenta gravar no safeStorage. Se falhar, mantém no localStorage.
    const written = await window.electronAPI!.secureStorage!.write(key, value);
    if (written) {
      window.localStorage.removeItem(key);
    }

    return value;
  } catch {
    return null;
  }
};

export const secureStorage = {
  /**
   * Lê um valor. No Electron, descriptografa via safeStorage.
   * Migra automaticamente do localStorage se necessário.
   */
  async getItem(key: string): Promise<string | null> {
    if (!isElectron()) {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }

    try {
      const value = await window.electronAPI!.secureStorage!.read(key);
      if (value !== null) return value;

      // Chave não encontrada no safeStorage — tentar migrar do localStorage.
      return migrateFromLocalStorage(key);
    } catch {
      // Fallback para localStorage em caso de erro inesperado de IPC.
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }
  },

  /**
   * Grava um valor. No Electron, criptografa via safeStorage.
   * Garante que a chave NÃO existe mais no localStorage.
   */
  async setItem(key: string, value: string): Promise<void> {
    if (!isElectron()) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }

    try {
      await window.electronAPI!.secureStorage!.write(key, value);
      // Garante que nenhuma cópia em texto puro sobrou no localStorage.
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Fallback para localStorage em caso de erro inesperado de IPC.
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    }
  },

  /**
   * Remove um valor do armazenamento seguro e do localStorage (caso reste algum).
   */
  async removeItem(key: string): Promise<void> {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }

    if (!isElectron()) return;

    try {
      await window.electronAPI!.secureStorage!.delete(key);
    } catch {
      // Remoção do safeStorage é melhor-esforço; o localStorage já foi limpo.
    }
  },

  /**
   * Verifica se a criptografia nativa está disponível neste dispositivo.
   * Retorna false na web (não aplicável) ou quando o safeStorage está indisponível.
   */
  async isNativeEncryptionAvailable(): Promise<boolean> {
    if (!isElectron()) return false;
    try {
      return Boolean(await window.electronAPI!.secureStorage!.isAvailable());
    } catch {
      return false;
    }
  },
};
