import type { DesktopUpdateStatus } from "@/lib/offlineConcentrator";

export interface DesktopUpdateSplashSummary {
  label: string;
  detail: string;
  progress: number | null;
  tone: "default" | "warning" | "error";
  primary: boolean;
  animateEllipsis: boolean;
}

const clampProgress = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value as number));
};

const resolveVersionLabel = (status: DesktopUpdateStatus) =>
  status.downloadedVersion || status.availableVersion || status.currentVersion || null;

export const getDesktopUpdateSplashSummary = (
  status: DesktopUpdateStatus | null,
): DesktopUpdateSplashSummary | null => {
  if (!status) return null;

  const versionLabel = resolveVersionLabel(status);
  const versionSuffix = versionLabel ? ` ${versionLabel}` : "";

  switch (status.status) {
    case "disabled":
      return {
        label: "Auto update indisponível neste ambiente.",
        detail: "O HappyCash vai abrir normalmente enquanto você estiver em desenvolvimento local.",
        progress: null,
        tone: "warning",
        primary: false,
        animateEllipsis: false,
      };
    case "checking":
      return {
        label: "Verificando atualizações do desktop...",
        detail: "Se houver nova versão, o download começa sozinho sem exigir acesso ao site.",
        progress: null,
        tone: "default",
        primary: false,
        animateEllipsis: true,
      };
    case "publishing":
      return {
        label: "Nova release ainda em publicação.",
        detail: status.error || "O HappyCash vai tentar novamente automaticamente em instantes.",
        progress: null,
        tone: "warning",
        primary: false,
        animateEllipsis: false,
      };
    case "downloading":
      return {
        label: `Atualizando para a nova versão${versionSuffix}`,
        detail: "Após a atualização, o sistema será reiniciado automaticamente.",
        progress: clampProgress(status.progress),
        tone: "default",
        primary: true,
        animateEllipsis: true,
      };
    case "downloaded":
      return {
        label: `Atualizando para a nova versão${versionSuffix}`,
        detail: "Após a atualização, o sistema será reiniciado automaticamente.",
        progress: 100,
        tone: "default",
        primary: true,
        animateEllipsis: true,
      };
    case "installing":
      return {
        label: `Atualizando para a nova versão${versionSuffix}`,
        detail: "Após a atualização, o sistema será reiniciado automaticamente.",
        progress: 100,
        tone: "default",
        primary: true,
        animateEllipsis: true,
      };
    case "error":
      return {
        label: "Não foi possível verificar atualizações agora.",
        detail: "O ERP vai continuar abrindo e você pode tentar novamente em Configurações.",
        progress: null,
        tone: "error",
        primary: false,
        animateEllipsis: false,
      };
    case "idle":
      if (!status.checkedAt) return null;
      return {
        label: "Desktop já está na versão mais recente.",
        detail: `Canal ${status.channel || "latest"} validado para a versão atual do HappyCash.`,
        progress: null,
        tone: "default",
        primary: false,
        animateEllipsis: false,
      };
    default:
      return null;
  }
};
