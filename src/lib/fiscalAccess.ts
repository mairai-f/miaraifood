import type { DesktopActivationRecord } from '@/lib/desktopActivation';

export const FISCAL_DESKTOP_PLAN_ID = 'pro';

interface FiscalDesktopAccessInput {
  isDesktop: boolean;
  licensed: boolean;
  planId: string | null;
  activation: DesktopActivationRecord | null;
}

export const canUseDesktopFiscalModule = ({
  isDesktop,
  licensed,
  planId,
  activation,
}: FiscalDesktopAccessInput) =>
  Boolean(
    isDesktop
    && licensed
    && planId === FISCAL_DESKTOP_PLAN_ID
    && activation?.appContext === 'happycash'
    && activation.installationId,
  );

export const buildDesktopFiscalAccessPayload = (activation: DesktopActivationRecord | null) => ({
  desktopInstallationId: activation?.installationId ?? null,
  desktopAppContext: activation?.appContext ?? null,
});

export const getDesktopFiscalBlockedMessage = ({
  isDesktop,
  licensed,
  planId,
  activation,
}: FiscalDesktopAccessInput) => {
  if (!isDesktop) {
    return 'No web, o HappyCash trabalha somente com cupom/recibo nao fiscal. A NFC-e fica disponivel apenas no HappyCash Desktop PRO.';
  }

  if (!licensed || !activation) {
    return 'Ative e valide esta maquina no HappyCash Desktop PRO para liberar o modulo fiscal NFC-e.';
  }

  if (activation.appContext !== 'happycash') {
    return 'Este modulo fiscal pertence ao HappyCash Desktop PRO.';
  }

  if (planId !== FISCAL_DESKTOP_PLAN_ID) {
    return 'A NFC-e fica disponivel somente para lojas com Plano PRO ativo no desktop.';
  }

  return 'O modulo fiscal NFC-e ainda nao esta disponivel nesta instalacao.';
};
