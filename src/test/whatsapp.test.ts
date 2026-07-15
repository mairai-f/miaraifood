import { describe, expect, it } from 'vitest';

import { buildClientCrmWhatsAppUrl, buildItemWhatsAppUrl, buildPaymentWhatsAppUrl, buildSupplierOrderWhatsAppUrl, buildWhatsAppUrl } from '@/lib/whatsapp';
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

const paidEntry: DebtEntry = {
  ...sampleEntry,
  id: 'entry-paid',
  product_id: 'product-paid',
  product_name: 'Arroz',
  quantity: 3,
  unit_price: 10,
  total: 30,
  date_added: '2026-04-20T02:51:00.000Z',
  date_paid: '2026-04-21T02:51:00.000Z',
  status: 'paid',
  deleted: true,
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

    expect(message).toContain('Mercadinho Azul - Conta em aberto');
  });

  it('cobra somente a conta aberta e ignora historico ja quitado', () => {
    const message = readMessage(buildWhatsAppUrl(
      '11999999999',
      'Maria',
      [paidEntry, sampleEntry],
      [
        { ...samplePayment, id: 'old-partial', amount: 5, date: '2026-04-20T03:00:00.000Z' },
        { ...samplePayment, id: 'old-total', amount: 25, type: 'total', date: '2026-04-21T03:00:00.000Z' },
        samplePayment,
      ],
      6,
      'Mercadinho Azul',
    ));

    expect(message).toContain('Cerveja');
    expect(message).not.toContain('Arroz');
    expect(message).toContain('Total em aberto: R$ 10.00');
    expect(message).toContain('Pago nesta conta: R$ 4.00');
    expect(message).toContain('Ficou para pagar: R$ 6.00');
  });

  it('pagamento parcial mostra quanto ainda ficou em aberto', () => {
    const message = readMessage(buildPaymentWhatsAppUrl(
      '11999999999',
      'Maria',
      4,
      [paidEntry, sampleEntry],
      6,
      'Mercadinho Azul',
    ));

    expect(message).toContain('Pagamento parcial registrado');
    expect(message).toContain('Conta ainda em aberto');
    expect(message).toContain('Ficou para pagar: R$ 6.00');
    expect(message).toContain('Cerveja');
    expect(message).not.toContain('Arroz');
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

  it('monta pedido de compra para o WhatsApp do fornecedor', () => {
    const url = buildSupplierOrderWhatsAppUrl('11999999999', 'Distribuidora Central', [
      { productName: 'Refrigerante', quantity: 4 },
      { productName: 'Água', quantity: 10 },
    ]);
    const message = readMessage(url);

    expect(url).toContain('wa.me/5511999999999');
    expect(message).toContain('Distribuidora Central');
    expect(message).toContain('Refrigerante: 4 un.');
    expect(message).toContain('Água: 10 un.');
  });
});
