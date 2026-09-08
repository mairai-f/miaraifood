import { describe, expect, it } from 'vitest';
import {
  buildDesktopFiscalAccessPayload,
  canUseDesktopFiscalModule,
  getDesktopFiscalBlockedMessage,
} from '@/lib/fiscalAccess';
import type { DesktopActivationRecord } from '@/lib/desktopActivation';

const activation: DesktopActivationRecord = {
  installationId: 'desktop-123',
  appContext: 'happycash',
  ownerUserId: 'owner-123',
  activatedAt: '2026-06-23T12:00:00.000Z',
};

describe('fiscal desktop access', () => {
  it('libera NFC-e somente no Desktop PRO licenciado', () => {
    expect(canUseDesktopFiscalModule({
      isDesktop: true,
      licensed: true,
      planId: 'pro',
      activation,
    })).toBe(true);

    expect(canUseDesktopFiscalModule({
      isDesktop: false,
      licensed: true,
      planId: 'pro',
      activation,
    })).toBe(false);

    expect(canUseDesktopFiscalModule({
      isDesktop: true,
      licensed: true,
      planId: 'completo',
      activation,
    })).toBe(false);
  });

  it('envia somente o contexto necessario para validar a instalacao desktop', () => {
    expect(buildDesktopFiscalAccessPayload(activation)).toEqual({
      desktopInstallationId: 'desktop-123',
      desktopAppContext: 'happycash',
    });
  });

  it('explica que o web segue com cupom nao fiscal', () => {
    expect(getDesktopFiscalBlockedMessage({
      isDesktop: false,
      licensed: true,
      planId: 'pro',
      activation,
    })).toContain('cupom/recibo nao fiscal');
  });
});
