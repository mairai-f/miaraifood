import type { DebtEntry, Payment } from '@/types';
import { normalizePhone } from './phone';

interface GroupedItem {
  name: string;
  quantity: number;
  total: number;
}

function groupEntries(entries: DebtEntry[]): GroupedItem[] {
  const map = new Map<string, GroupedItem>();
  for (const e of entries) {
    const key = e.product_name.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.quantity += e.quantity;
      existing.total += e.total;
    } else {
      map.set(key, { name: e.product_name, quantity: e.quantity, total: e.total });
    }
  }
  return Array.from(map.values());
}

function encodeWhatsAppMessage(msg: string): string {
  // Codifica a mensagem, mas mantém emojis intactos
  const encoded = encodeURIComponent(msg);
  return encoded
    .replace(/%F0%9F%93%8B/g, '📋') // 📋
    .replace(/%F0%9F%92%B0/g, '💰') // 💰
    .replace(/%E2%9E%95/g, '➕') // ➕
    .replace(/%E2%9C%85/g, '✅') // ✅
    .replace(/%F0%9F%8E%89/g, '🎉') // 🎉
    .replace(/%F0%9F%93%8A/g, '📊') // 📊
    .replace(/%F0%9F%92%B8/g, '💸'); // 💸
}

export function buildWhatsAppUrl(
  phone: string,
  clientName: string,
  entries: DebtEntry[],
  payments: Payment[],
  balance: number
): string {
  const grouped = groupEntries(entries);
  const items = grouped
    .map(g => `• ${g.name} (${g.quantity}x) — R$ ${g.total.toFixed(2)}`)
    .join('\n');

  const totalConsumed = entries.reduce((s, e) => s + e.total, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const msg = `Olá ${clientName}! 📋\n\n*AdegaGS - Resumo:*\n\n${items}\n\n📊 Total: R$ ${totalConsumed.toFixed(2)}\n💸 Pago: R$ ${totalPaid.toFixed(2)}\n💰 *Saldo devedor: R$ ${balance.toFixed(2)}*\n\nPor favor, entre em contato para pagamento. Obrigado!`;

  return `https://wa.me/${normalizePhone(phone)}?text=${encodeWhatsAppMessage(msg)}`;
}

export function buildItemWhatsAppUrl(
  phone: string,
  clientName: string,
  entries: DebtEntry[],
  balance: number
): string {
  const grouped = groupEntries(entries.filter(e => !e.deleted && e.status === 'pending'));
  const items = grouped
    .map(g => `• ${g.name} (${g.quantity}x) — R$ ${g.total.toFixed(2)}`)
    .join('\n');

  const msg = `Olá ${clientName}! 📋\n\nNovo registro na *AdegaGS*:\n\n${items}\n\n💰 *Saldo atual: R$ ${balance.toFixed(2)}*`;

  return `https://wa.me/${normalizePhone(phone)}?text=${encodeWhatsAppMessage(msg)}`;
}

export function buildSingleItemWhatsAppUrl(
  phone: string,
  clientName: string,
  productName: string,
  quantity: number,
  unitPrice: number,
  previousBalance: number,
  newBalance: number
): string {
  const addedValue = quantity * unitPrice;
  const msg = `Olá ${clientName}! 📋\n\n*AdegaGS - Novo Item:*\n\n• ${productName} (${quantity}x) — R$ ${addedValue.toFixed(2)}\n\n💰 Dívida anterior: R$ ${previousBalance.toFixed(2)}\n➕ Valor adicionado: R$ ${addedValue.toFixed(2)}\n💰 *Novo saldo: R$ ${newBalance.toFixed(2)}*`;

  return `https://wa.me/${normalizePhone(phone)}?text=${encodeWhatsAppMessage(msg)}`;
}

export function buildPaymentWhatsAppUrl(
  phone: string,
  clientName: string,
  paidAmount: number,
  remainingEntries: DebtEntry[],
  newBalance: number
): string {
  const grouped = groupEntries(remainingEntries.filter(e => !e.deleted && e.status === 'pending'));
  const isFullyPaid = grouped.length === 0 && newBalance <= 0;

  let msg: string;
  if (isFullyPaid) {
    msg = `Olá ${clientName}! 🎉\n\n*🏆 PARABÉNS! VOCÊ QUITOU SUA DÍVIDA! 🏆*\n\n✅ Valor pago: R$ ${paidAmount.toFixed(2)}\n\n🎊 *Todas as dívidas foram pagas!* 🎊\n💯 Você está em dia com o AdegaGS!\n\nObrigado pela confiança! 🙏`;
  } else {
    const items = grouped
      .map(g => `• ${g.name} (${g.quantity}x) — R$ ${g.total.toFixed(2)}`)
      .join('\n');

    msg = `Olá ${clientName}! 💰\n\n*AdegaGS - Pagamento Registrado:*\n\n✅ Valor pago: R$ ${paidAmount.toFixed(2)}\n\n${grouped.length > 0 ? `Dívidas restantes:\n${items}\n\n💰 *Saldo restante: R$ ${newBalance.toFixed(2)}*` : '🎉 Todas as dívidas foram pagas!'}`;
  }

  return `https://wa.me/${normalizePhone(phone)}?text=${encodeWhatsAppMessage(msg)}`;
}
