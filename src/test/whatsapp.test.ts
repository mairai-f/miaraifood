import { describe, expect, it } from 'vitest';

import { buildClientCrmWhatsAppUrl, buildItemWhatsAppUrl, buildPaymentWhatsAppUrl, buildWhatsAppUrl } from '@/lib/whatsapp';
import type { DebtEntry, Payment } from '@/types';

const sampleEntry: DebtEntry = {
  id: 'entry-1',
  client_id: 'client-1',
  product_id: 'product-1',
  product_name: 'Cerveja',
  quantity: 2,
  unit_price: 5,
  total: 10,
  date_added: '2026-04-22T02:51:00.000Z',
  status: 'pending',
  deleted: false,
  manual_deleted: false,
  registered_by: null,
};

const samplePayment: Payment = {
  id: 'payment-1',
  client_id: 'client-1',
  amount: 4,
  date: '2026-04-22T03:00:00.000Z',
  type: 'partial',
  details: null,
};

const readMessage = (url: string) => new URL(url).searchParams.get('text') ?? '';

describe('whatsapp messages', () => {
  it('usa o nome da empresa cadastrado no resumo enviado', () => {
    const message = readMessage(buildWhatsAppUrl(
      '11999999999',
      'Maria',
      [sampleEntry],
      [samplePayment],
      6,
      'Mercadinho Azul',
    ));

    expect(message).toContain('Mercadinho Azul - Resumo');
  });

  it('mantem fallback seguro quando o nome da empresa nao vier', () => {
    const itemMessage = readMessage(buildItemWhatsAppUrl(
      '11999999999',
      'Maria',
      [sampleEntry],
      10,
    ));
    const paymentMessage = readMessage(buildPaymentWhatsAppUrl(
      '11999999999',
      'Maria',
      10,
      [],
      0,
    ));

    expect(itemMessage).toContain('HappyCash');
    expect(paymentMessage).toContain('HappyCash');
  });

  it('monta mensagem de CRM com saldo em aberto', () => {
    const message = readMessage(buildClientCrmWhatsAppUrl(
      '11999999999',
      'Maria',
      42.5,
      'Mercadinho Azul',
    ));

    expect(message).toContain('Mercadinho Azul');
    expect(message).toContain('saldo em aberto');
    expect(message).toContain('R$ 42.50');
  });
});
