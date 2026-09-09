import { DEFAULT_COMPANY_NAME } from "@/lib/company";
import { describe, expect, it } from "vitest";

import { getDesktopUpdateSplashSummary } from "@/lib/desktopUpdateSplash";
import type { DesktopUpdateStatus } from "@/lib/offlineConcentrator";

const buildStatus = (overrides: Partial<DesktopUpdateStatus>): DesktopUpdateStatus => ({
  status: "idle",
  channel: "latest",
  currentVersion: "0.1.47",
  availableVersion: null,
  downloadedVersion: null,
  downloadedFile: null,
  manualDownloadUrl: null,
  installStartedAt: null,
  progress: null,
  bytesPerSecond: null,
  transferred: null,
  total: null,
  checkedAt: "2026-07-06T12:00:00.000Z",
  error: null,
  ...overrides,
});

describe("desktopUpdateSplash", () => {
  it("returns null when the updater is still idle before the first check", () => {
    expect(
      getDesktopUpdateSplashSummary(buildStatus({ checkedAt: null })),
    ).toBeNull();
  });

  it("describes the automatic download during splash", () => {
    expect(
      getDesktopUpdateSplashSummary(
        buildStatus({
          status: "downloading",
          availableVersion: "0.1.48",
          progress: 42.7,
        }),
      ),
    ).toEqual({
      label: "Atualizando para a nova versão 0.1.48",
      detail: "Após a atualização, o sistema será reiniciado automaticamente.",
      progress: 42.7,
      tone: "default",
      primary: true,
      animateEllipsis: true,
    });
  });

  it("explains when the update is already ready to install", () => {
    expect(
      getDesktopUpdateSplashSummary(
        buildStatus({
          status: "downloaded",
          downloadedVersion: "0.1.48",
        }),
      ),
    ).toEqual({
      label: "Atualizando para a nova versão 0.1.48",
      detail: `Download concluído. Reiniciando o ${DEFAULT_COMPANY_NAME} para instalar a atualização.`,
      progress: 100,
      tone: "default",
      primary: true,
      animateEllipsis: true,
    });
  });

  it("keeps the ERP opening when the preflight check fails", () => {
    expect(
      getDesktopUpdateSplashSummary(
        buildStatus({
          status: "error",
          error: "Falha temporária.",
        }),
      ),
    ).toEqual({
      label: "Não foi possível verificar atualizações agora.",
      detail: "O ERP vai continuar abrindo e você pode tentar novamente em Configurações.",
      progress: null,
      tone: "error",
      primary: false,
      animateEllipsis: false,
    });
  });
});
