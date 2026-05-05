export interface DesktopActivationRecord {
  ownerUserId: string;
  adminEmail: string;
  adminName: string;
  licenseKeySuffix: string;
  planId: string;
  validUntil: string | null;
  offlineGraceUntil: string | null;
  offlineGraceDays: number;
  activatedAt: string;
}

export interface DesktopActivationStatus {
  activated?: boolean;
  expired?: boolean;
  activation?: DesktopActivationRecord | null;
  error?: string;
}

export interface DesktopActivationSaveResult extends DesktopActivationStatus {
  success?: boolean;
}

export const isDesktopActivationAvailable = () =>
  typeof window !== 'undefined' && Boolean(window.electronAPI?.activation);

export const getDesktopActivationStatus = async (): Promise<DesktopActivationStatus> => {
  if (!window.electronAPI?.activation) return { activated: true, expired: false, activation: null };
  return window.electronAPI.activation.getStatus() as Promise<DesktopActivationStatus>;
};

export const saveDesktopActivation = async (payload: unknown): Promise<DesktopActivationSaveResult> => {
  if (!window.electronAPI?.activation) return { success: false, error: 'Ativacao local indisponivel fora do desktop.' };
  return window.electronAPI.activation.activate(payload) as Promise<DesktopActivationSaveResult>;
};
