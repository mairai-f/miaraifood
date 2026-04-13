import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createClient, FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ban, History, Minus, Plus, Receipt, Search, ShoppingCart, Wallet, X } from 'lucide-react';
import type { Expense, Product, Sale } from '@/types';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { normalizePhone } from '@/lib/phone';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import happyCashLogo from '@/assets/happycash-logo.png';
import { roleLabel } from '@/lib/access';

const db = supabase as any;

interface CartItem {
  product: Product;
  quantity: number;
}

interface CashSession {
  id?: string;
  openedAt: string;
  openingAmount: number;
  openedBy: string;
}

interface CashCloseReceipt {
  openedAt: string;
  closedAt: string;
  openedBy: string;
  closedBy: string;
  openingAmount: number;
  salesTotal: number;
  cashOutTotal: number;
  finalBalance: number;
  saleCount: number;
  cashOuts: Expense[];
  sales: Sale[];
}

interface CashCloseEmailResponse {
  message?: string;
  recipients?: string[];
}

type CloseCashEmailStatus = 'idle' | 'sending' | 'sent' | 'error';
type CloseCashSendChannel = 'email' | 'whatsapp';
type PaymentBreakdownItem = {
  key: string;
  label: string;
  total: number;
  count: number;
  sales: Sale[];
};

const CASH_SESSION_KEY = 'happycash-pdv-cash-session';
const CLOSE_CASH_WHATSAPP_PHONE_KEY = 'happycash-close-cash-whatsapp-phone';
const adminVerificationClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'happycash-admin-close-cash-verification',
    },
  }
);

const readCashSession = (): CashSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(CASH_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as CashSession;
    if (!parsed.openedAt || typeof parsed.openingAmount !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCashSession = (session: CashSession | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(CASH_SESSION_KEY);
      return;
    }
    window.localStorage.setItem(CASH_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore localStorage write failures and keep the in-memory state.
  }
};

const readCloseCashWhatsAppPhone = () => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(CLOSE_CASH_WHATSAPP_PHONE_KEY) ?? '';
  } catch {
    return '';
  }
};

const silentToast = {
  success: (_message?: string) => undefined,
  error: (_message?: string) => undefined,
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  fiado: 'Fiado',
  cartao_debito: 'Cartão débito',
  cartao_credito: 'Cartão crédito',
  outros: 'Outros',
};

const getPaymentBreakdown = (sales: Sale[]) => {
  const breakdown = new Map<string, PaymentBreakdownItem>();

  for (const sale of sales) {
    const key = sale.payment_method || 'outros';
    const label = paymentMethodLabels[key] || key;
    const existing = breakdown.get(key);

    if (existing) {
      existing.total += sale.total;
      existing.count += 1;
      existing.sales.push(sale);
      continue;
    }

    breakdown.set(key, {
      key,
      label,
      total: sale.total,
      count: 1,
      sales: [sale],
    });
  }

  return Array.from(breakdown.values()).sort((a, b) => b.total - a.total);
};

const paymentMethodPrintStyles: Record<string, { surface: string; border: string; chip: string; chipText: string; accent: string }> = {
  dinheiro: {
    surface: '#ecfdf5',
    border: '#a7f3d0',
    chip: '#d1fae5',
    chipText: '#065f46',
    accent: '#047857',
  },
  pix: {
    surface: '#ecfeff',
    border: '#a5f3fc',
    chip: '#cffafe',
    chipText: '#155e75',
    accent: '#0f766e',
  },
  cartao_debito: {
    surface: '#fffbeb',
    border: '#fde68a',
    chip: '#fef3c7',
    chipText: '#92400e',
    accent: '#b45309',
  },
  cartao_credito: {
    surface: '#f5f3ff',
    border: '#c4b5fd',
    chip: '#ede9fe',
    chipText: '#5b21b6',
    accent: '#6d28d9',
  },
  fiado: {
    surface: '#fff1f2',
    border: '#fda4af',
    chip: '#ffe4e6',
    chipText: '#9f1239',
    accent: '#be123c',
  },
  outros: {
    surface: '#f8fafc',
    border: '#d4d4d8',
    chip: '#f4f4f5',
    chipText: '#27272a',
    accent: '#18181b',
  },
};

const getPaymentMethodPrintStyle = (paymentMethod: string) => {
  return paymentMethodPrintStyles[paymentMethod] ?? paymentMethodPrintStyles.outros;
};

export default function PDV() {
  const { products, clients, sales, saleItems, expenses, createSale, addDebtEntries, addExpense, cancelSale } = useData();
  const { user, username, session, role, ownerUserId, isAdmin } = useAuth();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cashReceivedInputRef = useRef<HTMLInputElement>(null);
  const finalizeLockRef = useRef(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartItemPendingRemoval, setCartItemPendingRemoval] = useState<CartItem | null>(null);
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');
  const [discountInput, setDiscountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isDelivery, setIsDelivery] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showSalesSearch, setShowSalesSearch] = useState(false);
  const [showCancelledSales, setShowCancelledSales] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [saleSearch, setSaleSearch] = useState('');
  const [saleLimit, setSaleLimit] = useState(25);
  const [saleToCancel, setSaleToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [cashOutReason, setCashOutReason] = useState('');
  const [cashSession, setCashSession] = useState<CashSession | null>(() => readCashSession());
  const [cashSessionLoading, setCashSessionLoading] = useState(true);
  const [openingAmount, setOpeningAmount] = useState('');
  const [showCloseCashReceipt, setShowCloseCashReceipt] = useState(false);
  const [showCloseCashAuth, setShowCloseCashAuth] = useState(false);
  const [showCloseCashSendDialog, setShowCloseCashSendDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [closeCashAuthError, setCloseCashAuthError] = useState('');
  const [closeCashEmailStatus, setCloseCashEmailStatus] = useState<CloseCashEmailStatus>('idle');
  const [closeCashEmailMessage, setCloseCashEmailMessage] = useState('');
  const [closeCashEmailRecipients, setCloseCashEmailRecipients] = useState<string[]>([]);
  const [closeCashSendChannel, setCloseCashSendChannel] = useState<CloseCashSendChannel>('email');
  const [closeCashLastSentChannel, setCloseCashLastSentChannel] = useState<CloseCashSendChannel | null>(null);
  const [closeCashWhatsappPhone, setCloseCashWhatsappPhone] = useState(() => readCloseCashWhatsAppPhone());
  const [isVerifyingAdminPassword, setIsVerifyingAdminPassword] = useState(false);
  const [lastCloseReceipt, setLastCloseReceipt] = useState<CashCloseReceipt | null>(null);
  const [lastSaleData, setLastSaleData] = useState<{ items: CartItem[]; total: number; discount: number; method: string; change: number; clientId: string | null } | null>(null);
  const [isFinalizingSale, setIsFinalizingSale] = useState(false);

  const activeProducts = products.filter(p => !('deleted' in p && (p as any).deleted));
  const activeClients = clients.filter(c => !c.deleted);
  const sellerName = username || user?.email || 'Vendedor';
  const roleName = roleLabel[role];

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  const formatSaleDate = (value: string) => new Date(value).toLocaleString('pt-BR');
  const formatPaymentMethod = (value: string) => paymentMethodLabels[value] || value;
  const closeCashEmailDestination = user?.email?.trim() || '';

  const buildCloseCashWhatsAppMessage = (receipt: CashCloseReceipt) => {
    const paymentLines = getPaymentBreakdown(receipt.sales).map(item =>
      `• ${item.label}: ${formatMoney(item.total)} (${item.count} venda${item.count === 1 ? '' : 's'})`
    );
    const salesLines = receipt.sales.length > 0
      ? receipt.sales.map(sale => `• ${formatSaleDate(sale.date)} | ${formatPaymentMethod(sale.payment_method)} | ${formatMoney(sale.total)}`)
      : ['Sem vendas nesta abertura.'];

    const cashOutLines = receipt.cashOuts.length > 0
      ? receipt.cashOuts.map(expense => `• ${formatSaleDate(expense.date)} | ${expense.description} | ${formatMoney(expense.amount)}`)
      : ['Sem saídas nesta abertura.'];

    return [
      '🧾 *HappyCash - Fechamento do Caixa*',
      '',
      `Aberto por: ${receipt.openedBy}`,
      `Data de abertura: ${formatSaleDate(receipt.openedAt)}`,
      `Fechado por: ${receipt.closedBy}`,
      `Data de fechamento: ${formatSaleDate(receipt.closedAt)}`,
      '',
      `Abertura: ${formatMoney(receipt.openingAmount)}`,
      `Vendas: ${formatMoney(receipt.salesTotal)}`,
      `Saídas: ${formatMoney(receipt.cashOutTotal)}`,
      `Saldo final: ${formatMoney(receipt.finalBalance)}`,
      `Quantidade de vendas: ${receipt.saleCount}`,
      '',
      'Formas de pagamento',
      ...(paymentLines.length > 0 ? paymentLines : ['Sem vendas nesta abertura.']),
      '',
      `Entradas por venda (${receipt.saleCount})`,
      ...salesLines,
      '',
      'Saídas de caixa',
      ...cashOutLines,
    ].join('\n');
  };

  const getCloseCashEmailErrorMessage = async (error: unknown) => {
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json();
        if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
          return payload.error;
        }
      } catch {
        return 'O servidor recusou o envio do relatório por e-mail.';
      }
      return 'O servidor recusou o envio do relatório por e-mail.';
    }

    if (error instanceof FunctionsRelayError) {
      return 'Não foi possível encaminhar o relatório para a função de e-mail.';
    }

    if (error instanceof FunctionsFetchError) {
      return 'Não foi possível conectar ao serviço de envio de e-mail.';
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return 'Não foi possível enviar o relatório por e-mail.';
  };

  useEffect(() => {
    let active = true;

    const syncCashSession = async () => {
      if (!user || !ownerUserId) {
        if (active) {
          setCashSession(readCashSession());
          setCashSessionLoading(false);
        }
        return;
      }

      const storedSession = readCashSession();
      if (storedSession && active) {
        setCashSession(storedSession);
      }

      const { data, error } = await db
        .from('cash_sessions')
        .select('id, opened_at, opening_amount, opened_by_name')
        .eq('owner_user_id', ownerUserId)
        .eq('operator_user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error('Erro ao sincronizar caixa aberto:', error);
        setCashSessionLoading(false);
        return;
      }

      if (!data) {
        setCashSession(null);
        writeCashSession(null);
        setCashSessionLoading(false);
        return;
      }

      const nextSession: CashSession = {
        id: data.id,
        openedAt: data.opened_at,
        openingAmount: Number(data.opening_amount || 0),
        openedBy: data.opened_by_name,
      };

      setCashSession(nextSession);
      writeCashSession(nextSession);
      setCashSessionLoading(false);
    };

    void syncCashSession();

    return () => {
      active = false;
    };
  }, [ownerUserId, user]);

  useEffect(() => {
    if (closeCashWhatsappPhone.trim()) return;

    const metadataPhone = typeof user?.user_metadata?.phone === 'string' ? user.user_metadata.phone : '';
    const nextPhone = user?.phone || metadataPhone || readCloseCashWhatsAppPhone();
    if (nextPhone) {
      setCloseCashWhatsappPhone(nextPhone);
    }
  }, [closeCashWhatsappPhone, user]);

  const filtered = useMemo(() => {
    if (!search) return activeProducts;
    const q = search.trim().toLowerCase();
    return activeProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.code?.toString().includes(q)
    );
  }, [search, activeProducts]);

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const cartUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const discount = discountType === 'percent'
    ? subtotal * (parseFloat(discountInput) || 0) / 100
    : parseFloat(discountInput) || 0;
  const total = Math.max(0, subtotal - discount);
  const change = paymentMethod === 'dinheiro' ? Math.max(0, (parseFloat(cashReceived) || 0) - total) : 0;
  const canFinalizeCheckout = Boolean(paymentMethod)
    && (paymentMethod !== 'dinheiro' || (parseFloat(cashReceived) || 0) >= total)
    && (paymentMethod !== 'fiado' || Boolean(selectedClientId));

  const saleSearchTerm = saleSearch.trim().toLowerCase();
  const isInCurrentCashSession = (value: string) => {
    if (!cashSession) return false;
    return new Date(value).getTime() >= new Date(cashSession.openedAt).getTime();
  };

  const sessionScopedSales = useMemo(() => {
    return sales.filter(sale => isInCurrentCashSession(sale.date));
  }, [cashSession, sales]);

  const visibleSales = useMemo(() => {
    return sessionScopedSales
      .filter(sale => {
        if (!saleSearchTerm) return true;
        const client = activeClients.find(c => c.id === sale.client_id);
        return [
          sale.id,
          sale.payment_method,
          sale.seller_name || '',
          client?.name || '',
          formatSaleDate(sale.date),
          sale.total.toFixed(2),
        ].some(value => value.toLowerCase().includes(saleSearchTerm));
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, saleLimit);
  }, [activeClients, saleLimit, saleSearchTerm, sessionScopedSales]);

  const visibleSalesTotal = visibleSales
    .filter(sale => sale.status !== 'cancelled')
    .reduce((sum, sale) => sum + sale.total, 0);

  const handlePrintCloseCashReceipt = () => {
    if (!lastCloseReceipt || typeof window === 'undefined') return;

    const paymentBreakdown = getPaymentBreakdown(lastCloseReceipt.sales);
    const printWindow = window.open('', '_blank', 'width=1280,height=920');

    if (!printWindow) {
      console.error('Nao foi possivel abrir a janela de impressao do recibo.');
      return;
    }

    const summaryCards = [
      { label: 'Abertura', value: formatMoney(lastCloseReceipt.openingAmount), border: '#d4d4d8', surface: '#ffffff' },
      { label: 'Vendas', value: formatMoney(lastCloseReceipt.salesTotal), border: '#86efac', surface: '#f0fdf4' },
      { label: 'Saídas', value: formatMoney(lastCloseReceipt.cashOutTotal), border: '#fca5a5', surface: '#fef2f2' },
      { label: 'Saldo final', value: formatMoney(lastCloseReceipt.finalBalance), border: '#93c5fd', surface: '#eff6ff' },
    ];

    const summaryCardsHtml = summaryCards
      .map(card => `
        <div class="metric-card" style="border-color:${card.border};background:${card.surface};">
          <p class="metric-label">${escapeHtml(card.label)}</p>
          <p class="metric-value">${escapeHtml(card.value)}</p>
        </div>
      `)
      .join('');

    const paymentBreakdownHtml = paymentBreakdown.length > 0
      ? paymentBreakdown
          .map(item => {
            const share = lastCloseReceipt.salesTotal > 0 ? (item.total / lastCloseReceipt.salesTotal) * 100 : 0;
            const averageTicket = item.count > 0 ? item.total / item.count : 0;
            const styles = getPaymentMethodPrintStyle(item.key);
            const salesHtml = item.sales
              .map(sale => `
                <div class="payment-sale-row">
                  <div>
                    <p class="payment-sale-date">${escapeHtml(formatSaleDate(sale.date))}</p>
                    <p class="payment-sale-copy">Recebimento via ${escapeHtml(item.label)}</p>
                  </div>
                  <p class="payment-sale-value">${escapeHtml(formatMoney(sale.total))}</p>
                </div>
              `)
              .join('');

            return `
              <section class="payment-card" style="border-color:${styles.border};background:${styles.surface};">
                <div class="payment-card-top">
                  <div>
                    <span class="payment-chip" style="background:${styles.chip};color:${styles.chipText};border-color:${styles.border};">
                      ${escapeHtml(item.label)}
                    </span>
                    <p class="payment-total">${escapeHtml(formatMoney(item.total))}</p>
                    <p class="payment-meta" style="color:${styles.accent};">
                      ${item.count} venda${item.count === 1 ? '' : 's'} • Ticket médio ${escapeHtml(formatMoney(averageTicket))}
                    </p>
                  </div>
                  <div class="payment-share">
                    <p class="payment-share-label">Participação</p>
                    <p class="payment-share-value">${escapeHtml(share.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))}%</p>
                  </div>
                </div>
                <div class="payment-sales-list">
                  ${salesHtml}
                </div>
              </section>
            `;
          })
          .join('')
      : `
        <div class="empty-block">
          Nenhuma venda registrada neste fechamento.
        </div>
      `;

    const salesHtml = lastCloseReceipt.sales.length > 0
      ? lastCloseReceipt.sales
          .map(sale => `
            <tr>
              <td>${escapeHtml(formatSaleDate(sale.date))}</td>
              <td>${escapeHtml(formatPaymentMethod(sale.payment_method))}</td>
              <td class="table-value">${escapeHtml(formatMoney(sale.total))}</td>
            </tr>
          `)
          .join('')
      : `
        <tr>
          <td colspan="3" class="empty-row">Sem vendas nesta abertura.</td>
        </tr>
      `;

    const cashOutHtml = lastCloseReceipt.cashOuts.length > 0
      ? lastCloseReceipt.cashOuts
          .map(expense => `
            <tr>
              <td>${escapeHtml(formatSaleDate(expense.date))}</td>
              <td>${escapeHtml(expense.description)}</td>
              <td class="table-value table-value-negative">${escapeHtml(formatMoney(expense.amount))}</td>
            </tr>
          `)
          .join('')
      : `
        <tr>
          <td colspan="3" class="empty-row">Sem saídas nesta abertura.</td>
        </tr>
      `;

    const documentTitle = `recibo-fechamento-caixa-${new Date(lastCloseReceipt.closedAt).toISOString()}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(documentTitle)}</title>
          <style>
            :root {
              color-scheme: light;
            }

            * {
              box-sizing: border-box;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #e5e7eb;
              color: #0f172a;
              font-family: "Segoe UI", Arial, sans-serif;
            }

            body {
              padding: 24px;
            }

            .print-shell {
              max-width: 1120px;
              margin: 0 auto;
            }

            .receipt-sheet {
              overflow: hidden;
              border: 1px solid #cbd5e1;
              border-radius: 32px;
              background: radial-gradient(circle at top, #ffffff 0%, #f8fafc 42%, #ecfdf5 100%);
              box-shadow: 0 32px 72px rgba(15, 23, 42, 0.16);
            }

            .receipt-header {
              padding: 36px 40px 30px;
              text-align: center;
              background: linear-gradient(135deg, rgba(34,197,94,0.14), rgba(255,255,255,0.96), rgba(14,165,233,0.14));
              border-bottom: 1px solid #dbe4ee;
            }

            .brand-badge {
              width: 112px;
              height: 112px;
              margin: 0 auto;
              border-radius: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #ffffff;
              border: 1px solid rgba(255, 255, 255, 0.92);
              box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
            }

            .brand-badge img {
              width: 72px;
              height: 72px;
              object-fit: contain;
            }

            .eyebrow {
              margin: 18px 0 0;
              font-size: 16px;
              font-weight: 800;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: #0f172a;
            }

            .receipt-title {
              margin: 16px 0 0;
              font-size: 38px;
              line-height: 1.1;
              font-weight: 900;
              color: #020617;
            }

            .receipt-subtitle {
              max-width: 760px;
              margin: 16px auto 0;
              font-size: 18px;
              line-height: 1.7;
              font-weight: 600;
              color: #1f2937;
            }

            .receipt-body {
              padding: 28px 28px 34px;
            }

            .top-grid {
              display: grid;
              grid-template-columns: 1.25fr 0.75fr;
              gap: 16px;
            }

            .panel {
              border: 1px solid #d4d4d8;
              border-radius: 28px;
              background: rgba(255, 255, 255, 0.96);
              padding: 24px;
            }

            .panel.dark {
              border-color: rgba(15, 23, 42, 0.1);
              background: #0f172a;
              color: #ffffff;
            }

            .panel-kicker {
              margin: 0;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.28em;
              text-transform: uppercase;
              color: #334155;
            }

            .panel.dark .panel-kicker {
              color: rgba(255,255,255,0.7);
            }

            .responsible-line {
              margin: 16px 0 0;
              font-size: 24px;
              line-height: 1.45;
              font-weight: 700;
              color: #020617;
            }

            .responsible-date {
              margin: 6px 0 0;
              font-size: 18px;
              line-height: 1.6;
              font-weight: 600;
              color: #334155;
            }

            .divider {
              height: 1px;
              margin: 16px 0;
              background: #e5e7eb;
            }

            .dark-stat-label {
              margin: 0;
              font-size: 18px;
              font-weight: 600;
              color: rgba(255,255,255,0.78);
            }

            .dark-stat-value {
              margin: 8px 0 0;
              font-size: 44px;
              line-height: 1.08;
              font-weight: 900;
              color: #ffffff;
            }

            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 14px;
              margin-top: 16px;
            }

            .metric-card {
              border: 1px solid #d4d4d8;
              border-radius: 28px;
              padding: 22px;
            }

            .metric-label {
              margin: 0;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.28em;
              text-transform: uppercase;
              color: #334155;
            }

            .metric-value {
              margin: 14px 0 0;
              font-size: 34px;
              line-height: 1.1;
              font-weight: 900;
              color: #020617;
            }

            .section-card {
              margin-top: 16px;
              border: 1px solid #d4d4d8;
              border-radius: 28px;
              background: rgba(255,255,255,0.96);
              padding: 24px;
            }

            .section-header {
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              gap: 16px;
            }

            .section-kicker {
              margin: 0;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.28em;
              text-transform: uppercase;
              color: #334155;
            }

            .section-title {
              margin: 12px 0 0;
              font-size: 34px;
              line-height: 1.15;
              font-weight: 900;
              color: #020617;
            }

            .section-copy {
              margin: 10px 0 0;
              font-size: 18px;
              line-height: 1.7;
              font-weight: 600;
              color: #334155;
            }

            .section-meta {
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
              white-space: nowrap;
            }

            .payment-stack {
              display: grid;
              gap: 16px;
              margin-top: 20px;
            }

            .payment-card {
              border: 1px solid #d4d4d8;
              border-radius: 28px;
              padding: 22px;
              page-break-inside: avoid;
            }

            .payment-card-top {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 16px;
            }

            .payment-chip {
              display: inline-flex;
              align-items: center;
              border: 1px solid #d4d4d8;
              border-radius: 999px;
              padding: 8px 16px;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.22em;
              text-transform: uppercase;
            }

            .payment-total {
              margin: 18px 0 0;
              font-size: 36px;
              line-height: 1.08;
              font-weight: 900;
              color: #020617;
            }

            .payment-meta {
              margin: 10px 0 0;
              font-size: 18px;
              line-height: 1.6;
              font-weight: 700;
            }

            .payment-share {
              min-width: 180px;
              padding: 16px 18px;
              border: 1px solid rgba(255,255,255,0.9);
              border-radius: 24px;
              background: rgba(255,255,255,0.9);
            }

            .payment-share-label {
              margin: 0;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.24em;
              text-transform: uppercase;
              color: #334155;
            }

            .payment-share-value {
              margin: 10px 0 0;
              font-size: 34px;
              font-weight: 900;
              color: #020617;
            }

            .payment-sales-list {
              display: grid;
              gap: 12px;
              margin-top: 18px;
            }

            .payment-sale-row {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 16px;
              padding: 16px 18px;
              border: 1px solid rgba(255,255,255,0.88);
              border-radius: 22px;
              background: rgba(255,255,255,0.92);
            }

            .payment-sale-date {
              margin: 0;
              font-size: 18px;
              line-height: 1.55;
              font-weight: 800;
              color: #020617;
            }

            .payment-sale-copy {
              margin: 6px 0 0;
              font-size: 15px;
              line-height: 1.55;
              font-weight: 600;
              color: #334155;
            }

            .payment-sale-value {
              margin: 0;
              font-size: 28px;
              line-height: 1.2;
              font-weight: 900;
              color: #020617;
              white-space: nowrap;
            }

            .tables-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 16px;
              margin-top: 16px;
            }

            .table-card {
              border: 1px solid #d4d4d8;
              border-radius: 28px;
              background: rgba(255,255,255,0.96);
              padding: 24px;
            }

            .table {
              width: 100%;
              margin-top: 18px;
              border-collapse: collapse;
            }

            .table th {
              padding: 0 0 12px;
              text-align: left;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 0.24em;
              text-transform: uppercase;
              color: #475569;
            }

            .table td {
              padding: 14px 0;
              border-top: 1px solid #e5e7eb;
              font-size: 17px;
              line-height: 1.55;
              font-weight: 600;
              color: #0f172a;
              vertical-align: top;
            }

            .table-value {
              text-align: right;
              font-size: 22px;
              font-weight: 900;
              color: #020617;
              white-space: nowrap;
            }

            .table-value-negative {
              color: #b91c1c;
            }

            .empty-row {
              color: #475569;
              font-weight: 700;
            }

            .empty-block {
              border: 1px dashed #cbd5e1;
              border-radius: 24px;
              padding: 22px;
              background: #f8fafc;
              font-size: 18px;
              line-height: 1.6;
              font-weight: 700;
              color: #334155;
            }

            @media (max-width: 920px) {
              body {
                padding: 0;
              }

              .receipt-sheet {
                border-radius: 0;
                border: none;
                box-shadow: none;
              }

              .receipt-header,
              .receipt-body {
                padding-left: 18px;
                padding-right: 18px;
              }

              .top-grid,
              .metrics-grid,
              .tables-grid {
                grid-template-columns: 1fr;
              }

              .payment-card-top,
              .section-header,
              .payment-sale-row {
                flex-direction: column;
              }

              .section-meta,
              .payment-sale-value {
                white-space: normal;
              }
            }

            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm;
              }

              html, body {
                background: #ffffff;
              }

              body {
                padding: 0;
              }

              .receipt-sheet {
                border-radius: 0;
                border: none;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <main class="print-shell">
            <article class="receipt-sheet">
              <header class="receipt-header">
                <div class="brand-badge">
                  <img src="${happyCashLogo}" alt="HappyCash" />
                </div>
                <p class="eyebrow">HappyCash</p>
                <h1 class="receipt-title">Recibo de Fechamento do Caixa</h1>
                <p class="receipt-subtitle">
                  Uma única via grande, legível e completa para conferência e controle total do caixa encerrado.
                </p>
              </header>

              <section class="receipt-body">
                <div class="top-grid">
                  <section class="panel">
                    <p class="panel-kicker">Responsáveis</p>
                    <p class="responsible-line">Aberto por: <strong>${escapeHtml(lastCloseReceipt.openedBy)}</strong></p>
                    <p class="responsible-date">${escapeHtml(formatSaleDate(lastCloseReceipt.openedAt))}</p>
                    <div class="divider"></div>
                    <p class="responsible-line">Fechado por: <strong>${escapeHtml(lastCloseReceipt.closedBy)}</strong></p>
                    <p class="responsible-date">${escapeHtml(formatSaleDate(lastCloseReceipt.closedAt))}</p>
                  </section>

                  <section class="panel dark">
                    <p class="panel-kicker">Controle total</p>
                    <div style="margin-top:18px;">
                      <p class="dark-stat-label">Quantidade de vendas</p>
                      <p class="dark-stat-value">${lastCloseReceipt.saleCount}</p>
                    </div>
                    <div style="margin-top:18px;">
                      <p class="dark-stat-label">Saldo final</p>
                      <p class="dark-stat-value">${escapeHtml(formatMoney(lastCloseReceipt.finalBalance))}</p>
                    </div>
                  </section>
                </div>

                <section class="metrics-grid">
                  ${summaryCardsHtml}
                </section>

                <section class="section-card">
                  <div class="section-header">
                    <div>
                      <p class="section-kicker">Formas de pagamento</p>
                      <h2 class="section-title">Separação por recebimento</h2>
                      <p class="section-copy">
                        Cada forma mostra total recebido, ticket médio, participação e a lista das vendas daquele grupo.
                      </p>
                    </div>
                    <p class="section-meta">${paymentBreakdown.length} forma${paymentBreakdown.length === 1 ? '' : 's'} registrada${paymentBreakdown.length === 1 ? '' : 's'}</p>
                  </div>
                  <div class="payment-stack">
                    ${paymentBreakdownHtml}
                  </div>
                </section>

                <section class="tables-grid">
                  <section class="table-card">
                    <div class="section-header">
                      <div>
                        <p class="section-kicker">Entradas</p>
                        <h2 class="section-title" style="font-size:30px;">Vendas registradas</h2>
                      </div>
                      <p class="section-meta">${lastCloseReceipt.saleCount} total</p>
                    </div>
                    <table class="table">
                      <thead>
                        <tr>
                          <th>Horário</th>
                          <th>Pagamento</th>
                          <th style="text-align:right;">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${salesHtml}
                      </tbody>
                    </table>
                  </section>

                  <section class="table-card">
                    <div class="section-header">
                      <div>
                        <p class="section-kicker">Saídas</p>
                        <h2 class="section-title" style="font-size:30px;">Movimentações do caixa</h2>
                      </div>
                      <p class="section-meta">${lastCloseReceipt.cashOuts.length} total</p>
                    </div>
                    <table class="table">
                      <thead>
                        <tr>
                          <th>Horário</th>
                          <th>Descrição</th>
                          <th style="text-align:right;">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${cashOutHtml}
                      </tbody>
                    </table>
                  </section>
                </section>
              </section>
            </article>
          </main>

          <script>
            window.addEventListener('load', () => {
              const startPrint = () => {
                window.focus();
                window.print();
              };

              const logo = document.querySelector('img');
              if (logo && !logo.complete) {
                logo.addEventListener('load', () => setTimeout(startPrint, 250), { once: true });
                logo.addEventListener('error', () => setTimeout(startPrint, 250), { once: true });
              } else {
                setTimeout(startPrint, 250);
              }

              window.onafterprint = () => window.close();
            });
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const cancelledSales = useMemo(() => {
    return sessionScopedSales
      .filter(sale => sale.status === 'cancelled')
      .sort((a, b) => new Date(b.cancelled_at || b.date).getTime() - new Date(a.cancelled_at || a.date).getTime());
  }, [sessionScopedSales]);

  const cashSessionSales = useMemo(() => {
    return sessionScopedSales.filter(sale => sale.status !== 'cancelled');
  }, [sessionScopedSales]);

  const cashSessionCashOuts = useMemo(() => {
    return expenses.filter(expense => expense.category === 'Saída de caixa' && isInCurrentCashSession(expense.date));
  }, [cashSession, expenses]);

  const cashSalesTotal = cashSessionSales
    .reduce((sum, sale) => sum + sale.total, 0);
  const cashOutTotal = cashSessionCashOuts
    .reduce((sum, expense) => sum + expense.amount, 0);
  const cashOpeningAmount = cashSession?.openingAmount || 0;
  const currentCashBalance = cashOpeningAmount + cashSalesTotal - cashOutTotal;
  const parsedCashOutAmount = parseFloat(cashOutAmount);
  const cashOutAmountValue = Number.isFinite(parsedCashOutAmount) ? parsedCashOutAmount : 0;
  const cashOutExceedsBalance = cashOutAmountValue > currentCashBalance;
  const showOpenCashDialog = !cashSession && !showCloseCashReceipt && !cashSessionLoading;

  const addToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === p.id);
      if (existing) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1 }];
    });
    searchInputRef.current?.blur();
  };

  const focusProductSearch = () => {
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  const addSearchResultToCart = () => {
    const q = search.trim().toLowerCase();
    const exactMatch = q
      ? activeProducts.find(p =>
          p.code?.toString() === q ||
          p.barcode?.toLowerCase() === q ||
          p.name.toLowerCase() === q
        )
      : null;
    const product = exactMatch || filtered[0];

    if (!product) {
      silentToast.error('Produto não encontrado');
      return;
    }

    addToCart(product);
    setSearch('');
    silentToast.success(`${product.name} adicionado`);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.product.id !== productId));
  const requestRemoveFromCart = (item: CartItem) => setCartItemPendingRemoval(item);
  const confirmRemoveFromCart = () => {
    if (!cartItemPendingRemoval) return;
    removeFromCart(cartItemPendingRemoval.product.id);
    setCartItemPendingRemoval(null);
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    silentToast.success('Carrinho zerado');
    searchInputRef.current?.blur();
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    if (method === 'dinheiro') {
      requestAnimationFrame(() => {
        cashReceivedInputRef.current?.focus();
        cashReceivedInputRef.current?.select();
      });
      return;
    }
    requestAnimationFrame(() => {
      cashReceivedInputRef.current?.blur();
    });
  };

  const openCheckout = () => {
    if (!cashSession) { silentToast.error('Abra o caixa antes de vender'); return; }
    if (cart.length === 0) { silentToast.error('Carrinho vazio'); return; }
    setPaymentMethod('');
    setCashReceived('');
    setSelectedClientId('');
    setShowFinalizeConfirm(false);
    setShowCheckout(true);
  };

  const requestFinalizeConfirmation = () => {
    if (!canFinalizeCheckout || isFinalizingSale) return;
    setShowFinalizeConfirm(true);
  };

  const finalizeSale = async () => {
    if (!cashSession) { silentToast.error('Abra o caixa antes de vender'); return; }
    if (cart.length === 0) { silentToast.error('Carrinho vazio'); return; }
    if (!paymentMethod) return;
    if (finalizeLockRef.current) return;
    if (paymentMethod === 'dinheiro' && (parseFloat(cashReceived) || 0) < total) {
      silentToast.error('Valor recebido insuficiente'); return;
    }
    if (paymentMethod === 'fiado' && !selectedClientId) {
      silentToast.error('Selecione um cliente para fiado'); return;
    }

    finalizeLockRef.current = true;
    setIsFinalizingSale(true);
    try {
      const items = cart.map(i => ({
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        unit_price: i.product.price,
        cost_price: i.product.cost_price || 0,
        total: i.product.price * i.quantity,
      }));

      await createSale({
        client_id: selectedClientId || null,
        user_id: user!.id,
        seller_name: sellerName,
        is_delivery: isDelivery,
        status: 'completed',
        total,
        discount,
        payment_method: paymentMethod,
        cash_received: parseFloat(cashReceived) || 0,
        change_amount: change,
      }, items);

      // If fiado, create debt entries
      if (paymentMethod === 'fiado' && selectedClientId) {
        await addDebtEntries(items.map(i => ({
          clientId: selectedClientId,
          productId: i.product_id,
          productName: i.product_name,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          registeredBy: username || user?.email,
        })));
      }

      setLastSaleData({ items: [...cart], total, discount, method: paymentMethod, change, clientId: selectedClientId || null });
      setShowFinalizeConfirm(false);
      setShowCheckout(false);
      setShowReceipt(true);
      setCart([]);
      setDiscountInput('');
      setPaymentMethod('');
      setCashReceived('');
      setSelectedClientId('');
      setIsDelivery(false);
      silentToast.success('Venda finalizada!');
    } catch {
      silentToast.error('Erro ao finalizar venda');
    } finally {
      finalizeLockRef.current = false;
      setIsFinalizingSale(false);
    }
  };

  const sendReceiptWhatsApp = () => {
    if (!lastSaleData?.clientId) return;
    const client = activeClients.find(c => c.id === lastSaleData.clientId);
    if (!client?.phone) { silentToast.error('Cliente sem telefone'); return; }
    const lines = lastSaleData.items.map(i => `• ${i.product.name} x${i.quantity} — R$ ${(i.product.price * i.quantity).toFixed(2)}`);
    const msg = `🧾 *AdegaGS - Comprovante*\n\n${lines.join('\n')}\n\n${lastSaleData.discount > 0 ? `Desconto: R$ ${lastSaleData.discount.toFixed(2)}\n` : ''}💰 *Total: R$ ${lastSaleData.total.toFixed(2)}*\n📅 ${new Date().toLocaleString('pt-BR')}\nPagamento: ${lastSaleData.method}`;
    openExternalUrl(`https://wa.me/${normalizePhone(client.phone)}?text=${encodeURIComponent(msg)}`);
  };

  const handleOpenCash = async () => {
    if (!user || !ownerUserId) {
      silentToast.error('Faça login novamente para abrir o caixa');
      return;
    }

    const amount = parseFloat(openingAmount) || 0;
    if (amount < 0) { silentToast.error('Valor de abertura inválido'); return; }

    const { data, error } = await db
      .from('cash_sessions')
      .insert({
        owner_user_id: ownerUserId,
        operator_user_id: user.id,
        operator_name: sellerName,
        opened_by_name: sellerName,
        opening_amount: amount,
      })
      .select('id, opened_at, opening_amount, opened_by_name')
      .single();

    if (error || !data) {
      console.error('Erro ao abrir caixa:', error);
      silentToast.error('Não foi possível abrir o caixa');
      return;
    }

    const session: CashSession = {
      id: data.id,
      openedAt: data.opened_at,
      openingAmount: Number(data.opening_amount || 0),
      openedBy: data.opened_by_name,
    };

    writeCashSession(session);
    setCashSession(session);
    setOpeningAmount('');
    setSaleSearch('');
    setSaleLimit(25);
    silentToast.success('Caixa aberto!');
  };

  const handleCloseCash = async () => {
    if (!cashSession) return;

    const receipt: CashCloseReceipt = {
      openedAt: cashSession.openedAt,
      closedAt: new Date().toISOString(),
      openedBy: cashSession.openedBy,
      closedBy: sellerName,
      openingAmount: cashOpeningAmount,
      salesTotal: cashSalesTotal,
      cashOutTotal,
      finalBalance: currentCashBalance,
      saleCount: cashSessionSales.length,
      cashOuts: cashSessionCashOuts,
      sales: cashSessionSales,
    };

    if (cashSession.id) {
      const { error } = await db
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: receipt.closedAt,
          closed_by_user_id: user?.id ?? null,
          closed_by_name: sellerName,
          closing_balance: currentCashBalance,
        })
        .eq('id', cashSession.id);

      if (error) {
        console.error('Erro ao fechar caixa:', error);
        silentToast.error('Não foi possível registrar o fechamento do caixa');
        return;
      }
    }

    setLastCloseReceipt(receipt);
    setCloseCashEmailStatus('idle');
    setCloseCashEmailMessage('');
    setCloseCashEmailRecipients([]);
    setCloseCashLastSentChannel(null);
    setShowCloseCashSendDialog(false);
    writeCashSession(null);
    setCashSession(null);
    setCashSessionLoading(false);
    setShowSalesSearch(false);
    setShowCashOut(false);
    setSaleSearch('');
    setSaleLimit(25);
    setShowCloseCashReceipt(true);
    silentToast.success('Caixa fechado!');
  };

  const sendCloseCashReportEmail = async (receipt: CashCloseReceipt) => {
    if (!user || !closeCashEmailDestination || !session?.access_token) {
      setCloseCashLastSentChannel('email');
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage('Faça login novamente para enviar o relatório por e-mail.');
      setCloseCashEmailRecipients([]);
      return;
    }

    setShowCloseCashSendDialog(false);
    setCloseCashLastSentChannel('email');
    setCloseCashEmailStatus('sending');
    setCloseCashEmailMessage('Enviando relatório por e-mail...');
    setCloseCashEmailRecipients([]);

    try {
      const { data, error } = await supabase.functions.invoke<CashCloseEmailResponse>('send-cash-close-report', {
        body: {
          receipt,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      setCloseCashEmailStatus('sent');
      setCloseCashEmailMessage(data?.message || 'Relatório enviado por e-mail com sucesso.');
      setCloseCashEmailRecipients(data?.recipients ?? []);
    } catch (error) {
      console.error('Erro ao enviar relatório de fechamento por e-mail:', error);
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage(await getCloseCashEmailErrorMessage(error));
      setCloseCashEmailRecipients([]);
    }
  };

  const sendCloseCashReportWhatsApp = (receipt: CashCloseReceipt) => {
    const normalizedPhone = normalizePhone(closeCashWhatsappPhone);
    setCloseCashLastSentChannel('whatsapp');

    if (!normalizedPhone) {
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage('Informe um número de WhatsApp para enviar o recibo.');
      setCloseCashEmailRecipients([]);
      return;
    }

    const message = buildCloseCashWhatsAppMessage(receipt);
    const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
    const openedWindow = openExternalUrl(url);

    if (!openedWindow) {
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage('Não foi possível abrir o WhatsApp para enviar o recibo.');
      setCloseCashEmailRecipients([]);
      return;
    }

    try {
      window.localStorage.setItem(CLOSE_CASH_WHATSAPP_PHONE_KEY, normalizedPhone);
    } catch {
      // Ignore localStorage persistence failures for the WhatsApp destination number.
    }

    setShowCloseCashSendDialog(false);
    setCloseCashWhatsappPhone(normalizedPhone);
    setCloseCashEmailStatus('sent');
    setCloseCashEmailMessage('Recibo preparado para envio pelo WhatsApp.');
    setCloseCashEmailRecipients([normalizedPhone]);
  };

  const openCloseCashSendDialog = () => {
    setCloseCashSendChannel(closeCashEmailDestination ? 'email' : 'whatsapp');
    setShowCloseCashSendDialog(true);
  };

  const requestCloseCash = () => {
    if (!cashSession) return;
    if (!isAdmin) {
      silentToast.error('Somente administrador pode fechar o caixa');
      return;
    }
    if (cart.length > 0) {
      silentToast.error('Finalize ou zere o carrinho antes de fechar o caixa');
      return;
    }

    setAdminPassword('');
    setCloseCashAuthError('');
    setShowCloseCashAuth(true);
  };

  const confirmCloseCashWithAdminPassword = async () => {
    if (!isAdmin) {
      setCloseCashAuthError('Somente administrador pode fechar o caixa.');
      return;
    }

    if (!user?.email) {
      setCloseCashAuthError('Não foi possível identificar o usuário logado.');
      return;
    }

    if (!adminPassword.trim()) {
      setCloseCashAuthError('Digite sua senha para confirmar.');
      return;
    }

    setIsVerifyingAdminPassword(true);
    setCloseCashAuthError('');

    try {
      const { error } = await adminVerificationClient.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });

      if (error) {
        setCloseCashAuthError('Senha incorreta.');
        return;
      }

      await adminVerificationClient.auth.signOut();
      setShowCloseCashAuth(false);
      setAdminPassword('');
      await handleCloseCash();
    } catch (error) {
      console.error('Erro ao validar senha para fechamento do caixa:', error);
      setCloseCashAuthError('Não foi possível validar sua senha.');
    } finally {
      setIsVerifyingAdminPassword(false);
    }
  };

  const handleCashOut = async () => {
    if (!cashSession) { silentToast.error('Abra o caixa antes de registrar saída'); return; }
    const amount = cashOutAmountValue;
    if (!amount || amount <= 0) { silentToast.error('Valor inválido'); return; }
    if (!cashOutReason.trim()) { silentToast.error('Informe o motivo da saída'); return; }
    if (cashOutExceedsBalance) {
      silentToast.error(`Saída maior que o saldo disponível: ${formatMoney(currentCashBalance)}`);
      return;
    }

    try {
      await addExpense(cashOutReason.trim(), amount, 'Saída de caixa');
      setCashOutAmount('');
      setCashOutReason('');
      setShowCashOut(false);
      silentToast.success('Saída de caixa registrada!');
    } catch (error) {
      console.error('Erro ao registrar saída de caixa:', error);
      silentToast.error('Não foi possível registrar a saída de caixa');
    }
  };

  const handleCancelSale = async () => {
    if (!saleToCancel) return;
    if (!cancelReason.trim()) { silentToast.error('Informe o motivo do cancelamento'); return; }

    try {
      await cancelSale(saleToCancel, cancelReason.trim());
      setSaleToCancel(null);
      setCancelReason('');
      silentToast.success('Venda cancelada!');
    } catch (error) {
      console.error('Erro ao cancelar venda:', error);
      const message = error instanceof Error ? error.message : 'Não foi possível cancelar a venda';
      silentToast.error(message);
    }
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return element.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === 'F1') {
        event.preventDefault();
        navigate('/');
        return;
      }

      if (event.key === 'Escape' && event.target === searchInputRef.current) {
        event.preventDefault();
        setSearch('');
        searchInputRef.current?.blur();
        return;
      }

      if (showFinalizeConfirm) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setShowFinalizeConfirm(false);
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          finalizeSale();
          return;
        }

        return;
      }

      if (showCheckout) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setShowFinalizeConfirm(false);
          setShowCheckout(false);
          return;
        }

        if (!isEditableTarget(event.target)) {
          if (event.key === '1') {
            event.preventDefault();
            handlePaymentMethodChange('dinheiro');
            return;
          }

          if (event.key === '2') {
            event.preventDefault();
            handlePaymentMethodChange('pix');
            return;
          }

          if (event.key === '3') {
            event.preventDefault();
            handlePaymentMethodChange('fiado');
            return;
          }

          if (event.key === '4') {
            event.preventDefault();
            handlePaymentMethodChange('cartao_debito');
            return;
          }

          if (event.key === '5') {
            event.preventDefault();
            handlePaymentMethodChange('cartao_credito');
            return;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            requestFinalizeConfirmation();
            return;
          }
        }
        return;
      }

      if (showReceipt || showSalesSearch || showCancelledSales || showCashOut || showCloseCashReceipt || showOpenCashDialog || saleToCancel) return;

      if (event.key === 'Escape' && !showReceipt) {
        event.preventDefault();
        clearCart();
        return;
      }

      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        event.preventDefault();
        focusProductSearch();
        return;
      }

      if (!isEditableTarget(event.target)) {
        if (event.key === '1') {
          event.preventDefault();
          navigate('/');
          return;
        }

        if (event.key === '2') {
          event.preventDefault();
          setShowSalesSearch(true);
          return;
        }

        if (event.key === '3') {
          event.preventDefault();
          setShowCashOut(true);
          return;
        }

        if (event.key === '4') {
          event.preventDefault();
          openCheckout();
          return;
        }

        if (event.key === '5') {
          event.preventDefault();
          if (isAdmin) {
            requestCloseCash();
          }
          return;
        }

        if (event.key === '0') {
          event.preventDefault();
          navigate('/');
          return;
        }

        if (event.key === '6') {
          event.preventDefault();
          setShowCashOut(true);
          return;
        }

        if (event.key === '7') {
          event.preventDefault();
          if (isAdmin) {
            requestCloseCash();
          }
          return;
        }
      }

      if (event.key === 'F2') {
        event.preventDefault();
        openCheckout();
        return;
      }

      if (event.key === 'F3') {
        event.preventDefault();
        openCheckout();
        return;
      }

      if (event.key === 'F4') {
        event.preventDefault();
        openCheckout();
        return;
      }

      if (event.key === 'F5') {
        event.preventDefault();
        openCheckout();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProducts, filtered, search, cart, discount, paymentMethod, cashReceived, selectedClientId, total, change, canFinalizeCheckout, showCheckout, showFinalizeConfirm, showReceipt, showSalesSearch, showCancelledSales, showCashOut, showCloseCashReceipt, showOpenCashDialog, saleToCancel, navigate, isAdmin]);

  return (
    <div className="flex min-h-[calc(100vh-1.5rem)] flex-col gap-4 sm:min-h-[calc(100vh-2rem)] lg:h-[calc(100vh-3rem)] lg:flex-row">
      {/* Products panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Caixa</h1>
            <p className="text-sm text-muted-foreground">
              Operador do caixa: <span className="font-medium text-foreground">{sellerName}</span> • {roleName}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>Menu (1)</Button>
            <Button variant="outline" size="sm" onClick={() => setShowSalesSearch(true)}><History className="h-4 w-4 mr-1" />Buscar vendas (2)</Button>
            <Button variant="outline" size="sm" onClick={() => setShowCashOut(true)}><Wallet className="h-4 w-4 mr-1" />Saída de caixa (3)</Button>
            <span className="inline-flex items-center rounded border border-border px-2.5 py-1 text-sm font-semibold">
              Caixa: {cashSession ? formatMoney(currentCashBalance) : 'fechado'}
            </span>
            {isAdmin ? (
              <Button variant="destructive" size="sm" onClick={requestCloseCash} disabled={!cashSession}>Fechar caixa (5)</Button>
            ) : (
              <span className="inline-flex items-center rounded border border-border px-2.5 py-1 text-xs text-muted-foreground">
                Fechamento apenas por administrador
              </span>
            )}
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            className="h-11 pl-11 text-base"
            placeholder="Espaço: buscar produto por nome, código ou barras. Enter adiciona."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSearchResultToCart();
              }
            }}
          />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
          {filtered.map(p => (
            <motion.div key={p.id} whileTap={{ scale: 0.95 }}>
              <Card className="cursor-pointer hover:border-primary/50 transition-colors border-border/50" onClick={() => { addToCart(p); setSearch(''); }}>
                <CardContent className="p-4">
                  <p className="font-medium text-sm truncate">{p.code ? `#${p.code} ` : ''}{p.name}</p>
                  <p className="text-primary font-bold text-base">R$ {p.price.toFixed(2)}</p>
                  {p.stock > 0 && p.stock <= (p.min_stock || 5) && (
                    <p className="text-xs text-destructive">⚠️ Estoque: {p.stock}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cart panel */}
      <div className="flex min-h-[70vh] w-full flex-col lg:min-h-0 lg:w-[32rem] xl:w-[38rem]">
        <Card className="flex min-h-0 flex-1 flex-col border-border/50">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Carrinho ({cart.length}) <span className="text-xs font-medium text-muted-foreground">Esc zera</span></CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col p-4 pt-0 gap-3">
            <div className="min-h-0 flex-1 overflow-auto space-y-2">
              {cart.map(i => (
                <div key={i.product.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.quantity} x {formatMoney(i.product.price)}
                    </p>
                    <p className="text-sm font-semibold text-primary">{formatMoney(i.product.price * i.quantity)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(i.product.id, -1)}><Minus className="h-4 w-4" /></Button>
                    <span className="text-sm w-8 text-center font-medium">{i.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(i.product.id, 1)}><Plus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => requestRemoveFromCart(i)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Carrinho vazio</p>}
            </div>

            <div className="rounded-lg border border-border bg-background/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Itens adicionados</span>
                <span>{cartUnits} unidade{cartUnits === 1 ? '' : 's'}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total dos itens adicionados</span>
                <span className="text-primary">{formatMoney(subtotal)}</span>
              </div>
            </div>

            <Button type="button" onClick={() => openCheckout()} className="h-11 w-full text-base" disabled={cart.length === 0 || isFinalizingSale}>
              <Receipt className="h-5 w-5 mr-2" />Finalizar Venda (4)
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!cartItemPendingRemoval} onOpenChange={open => { if (!open) setCartItemPendingRemoval(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item do carrinho?</AlertDialogTitle>
            <AlertDialogDescription>
              {cartItemPendingRemoval
                ? `${cartItemPendingRemoval.product.name} (${cartItemPendingRemoval.quantity} unidade${cartItemPendingRemoval.quantity === 1 ? '' : 's'}) será removido do carrinho.`
                : 'Confirme a remoção do item.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveFromCart}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Checkout dialog */}
      <Dialog open={showCheckout} onOpenChange={open => { if (!isFinalizingSale) setShowCheckout(open); }}>
        <DialogContent className="max-w-3xl overflow-hidden" onOpenAutoFocus={event => event.preventDefault()}>
          <DialogHeader className="space-y-1 pb-1"><DialogTitle>Finalizar venda</DialogTitle></DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm font-semibold">Itens do carrinho</p>
                <div className="space-y-1.5">
                  {cart.map(i => (
                    <div key={i.product.id} className="flex justify-between gap-3 text-sm">
                      <span className="truncate">{i.product.name} x{i.quantity}</span>
                      <span className="font-medium">R$ {(i.product.price * i.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  {cart.length === 0 && <p className="text-sm text-muted-foreground">Carrinho vazio</p>}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {discount > 0 && <div className="flex justify-between text-sm text-destructive"><span>Desconto</span><span>-R$ {discount.toFixed(2)}</span></div>}
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">R$ {total.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_88px] gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-sm">Desconto</Label>
                  <Input type="number" step="0.01" placeholder="0" value={discountInput} onChange={e => setDiscountInput(e.target.value)} className="h-9 text-sm" />
                </div>
                <Select value={discountType} onValueChange={v => setDiscountType(v as 'value' | 'percent')}>
                  <SelectTrigger className="w-20 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value">R$</SelectItem>
                    <SelectItem value="percent">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Pagamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('dinheiro')}>[1] Dinheiro</Button>
                  <Button type="button" variant={paymentMethod === 'pix' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('pix')}>[2] Pix</Button>
                  <Button type="button" variant={paymentMethod === 'fiado' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('fiado')}>[3] Fiado</Button>
                  <Button type="button" variant={paymentMethod === 'cartao_debito' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('cartao_debito')}>[4] Débito</Button>
                  <Button type="button" className="col-span-2" variant={paymentMethod === 'cartao_credito' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('cartao_credito')}>[5] Crédito</Button>
                </div>
              </div>

              {paymentMethod === 'dinheiro' && (
                <div className="space-y-1">
                  <Label className="text-sm">Valor recebido</Label>
                  <Input
                    ref={cashReceivedInputRef}
                    type="number"
                    step="0.01"
                  value={cashReceived}
                  onFocus={e => e.currentTarget.select()}
                  onChange={e => setCashReceived(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.blur();
                    }
                  }}
                    className="h-9 text-sm"
                  />
                  {change > 0 && <p className="text-sm text-primary font-bold">Troco: R$ {change.toFixed(2)}</p>}
                </div>
              )}

              <Button
                type="button"
                variant={isDelivery ? 'default' : 'outline'}
                className="h-9 w-full text-sm"
                onClick={() => setIsDelivery(prev => !prev)}
              >
                {isDelivery ? 'Delivery ativo' : 'Balcão / Retirada'}
              </Button>

              {paymentMethod === 'fiado' && (
                <div className="space-y-1">
                  <Label className="text-sm">Cliente</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {activeClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <p className="text-xs text-muted-foreground">Enter pede confirmação para finalizar.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setShowCheckout(false)} disabled={isFinalizingSale}>Voltar</Button>
            <Button type="button" onClick={requestFinalizeConfirmation} disabled={cart.length === 0 || isFinalizingSale || !canFinalizeCheckout}>
              <Receipt className="h-4 w-4 mr-2" />Finalizar venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinalizeConfirm} onOpenChange={open => { if (!isFinalizingSale) setShowFinalizeConfirm(open); }}>
        <DialogContent className="max-w-sm" onOpenAutoFocus={event => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Finalizar venda?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Confirma a finalização desta venda agora?</p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setShowFinalizeConfirm(false)} disabled={isFinalizingSale}>Voltar</Button>
            <Button type="button" onClick={finalizeSale} disabled={isFinalizingSale || !canFinalizeCheckout}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales search dialog */}
      <Dialog open={showSalesSearch} onOpenChange={setShowSalesSearch}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader><DialogTitle>Buscar vendas</DialogTitle></DialogHeader>
          <div className="flex min-h-0 flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <Input
                value={saleSearch}
                onChange={e => setSaleSearch(e.target.value)}
                placeholder="Buscar por vendedor, cliente, data, total ou forma..."
                className="h-10 text-sm"
              />
              <Select value={saleLimit.toString()} onValueChange={value => setSaleLimit(parseInt(value, 10))}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 75, 100, 125, 150].map(limit => (
                    <SelectItem key={limit} value={limit.toString()}>0-{limit} registros</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Total exibido</p>
                <p className="text-lg font-bold text-primary">{formatMoney(visibleSalesTotal)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Vendas exibidas</p>
                <p className="text-lg font-bold">{visibleSales.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Vendas canceladas</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-bold text-destructive">{cancelledSales.length}</p>
                  <Button variant="outline" size="sm" onClick={() => setShowCancelledSales(true)}>Abrir motivos</Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 max-h-[55vh] overflow-auto space-y-2">
              {visibleSales.map(sale => {
                const client = activeClients.find(c => c.id === sale.client_id);
                const items = saleItems.filter(item => item.sale_id === sale.id);
                const isCancelled = sale.status === 'cancelled';
                return (
                  <div key={sale.id} className={`rounded-lg border border-border p-3 ${isCancelled ? 'opacity-60' : ''}`}>
                    <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="font-semibold">{formatSaleDate(sale.date)}</p>
                          <span className="text-sm text-muted-foreground">{sale.is_delivery ? 'Delivery' : 'Balcão'}</span>
                          {isCancelled && <span className="text-sm font-semibold text-destructive">Cancelada</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Vendedor: {sale.seller_name || (sale.user_id === user?.id ? sellerName : 'Não informado')}
                          {client?.name ? ` | Cliente: ${client.name}` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {items.length > 0
                            ? items.map(item => `${item.product_name} x${item.quantity}`).join(' | ')
                            : 'Itens não carregados'}
                        </p>
                        {sale.cancel_reason && <p className="text-sm text-destructive">Motivo: {sale.cancel_reason}</p>}
                      </div>
                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        <div className="text-left lg:text-right">
                          <p className="text-lg font-bold text-primary">{formatMoney(sale.total)}</p>
                          <p className="text-sm text-muted-foreground">Desconto: {formatMoney(sale.discount || 0)}</p>
                          <p className="text-sm text-muted-foreground">{sale.payment_method}</p>
                        </div>
                        {!isCancelled && (
                          <Button variant="destructive" size="sm" onClick={() => { setSaleToCancel(sale.id); setCancelReason(''); }}>
                            <Ban className="h-4 w-4 mr-1" />Cancelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {visibleSales.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancelled sales dialog */}
      <Dialog open={showCancelledSales} onOpenChange={setShowCancelledSales}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
          <DialogHeader><DialogTitle>Vendas canceladas</DialogTitle></DialogHeader>
          <div className="max-h-[70vh] overflow-auto space-y-2">
            {cancelledSales.map(sale => {
              const client = activeClients.find(c => c.id === sale.client_id);
              const items = saleItems.filter(item => item.sale_id === sale.id);
              return (
                <div key={sale.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold">{formatSaleDate(sale.cancelled_at || sale.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        Venda: {formatSaleDate(sale.date)}
                        {client?.name ? ` | Cliente: ${client.name}` : ''}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Vendedor: {sale.seller_name || (sale.user_id === user?.id ? sellerName : 'Não informado')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {items.length > 0
                          ? items.map(item => `${item.product_name} x${item.quantity}`).join(' | ')
                          : 'Itens não carregados'}
                      </p>
                      <p className="text-sm font-medium text-destructive">Motivo: {sale.cancel_reason || 'Motivo não informado'}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-bold text-primary">{formatMoney(sale.total)}</p>
                      <p className="text-sm text-muted-foreground">Desconto: {formatMoney(sale.discount || 0)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {cancelledSales.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda cancelada.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelledSales(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash out dialog */}
      <Dialog open={showCashOut} onOpenChange={setShowCashOut}>
        <DialogContent>
          <DialogHeader><DialogTitle>Saída de caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Entradas</p>
                <p className="text-sm font-bold text-primary">{formatMoney(cashOpeningAmount + cashSalesTotal)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Saídas</p>
                <p className="text-sm font-bold text-destructive">{formatMoney(cashOutTotal)}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Saldo no caixa</p>
                <p className="text-sm font-bold">{formatMoney(currentCashBalance)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Valor da saída</Label>
              <Input
                type="number"
                step="0.01"
                value={cashOutAmount}
                onChange={e => setCashOutAmount(e.target.value)}
                placeholder="0.00"
                className={cashOutExceedsBalance ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {cashOutExceedsBalance && (
                <p className="text-sm font-medium text-destructive">
                  O valor excede o saldo do caixa: {formatMoney(currentCashBalance)}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Textarea value={cashOutReason} onChange={e => setCashOutReason(e.target.value)} placeholder="Ex: sangria, troco, pagamento fornecedor..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCashOut(false)}>Fechar</Button>
            <Button onClick={handleCashOut} disabled={cashOutExceedsBalance}>Registrar saída</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCloseCashAuth}
        onOpenChange={open => {
          setShowCloseCashAuth(open);
          if (!open) {
            setAdminPassword('');
            setCloseCashAuthError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar fechamento (admin)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para fechar o caixa, confirme a senha do administrador logado.
            </p>
            <div className="space-y-1">
              <Label>Usuário</Label>
              <Input value={username || user?.email || 'Usuário'} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Senha</Label>
              <Input
                autoFocus
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void confirmCloseCashWithAdminPassword();
                  }
                }}
                placeholder="Digite sua senha"
              />
            </div>
            {closeCashAuthError && (
              <p className="text-sm font-medium text-destructive">{closeCashAuthError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCloseCashAuth(false);
                setAdminPassword('');
                setCloseCashAuthError('');
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmCloseCashWithAdminPassword()} disabled={isVerifyingAdminPassword}>
              {isVerifyingAdminPassword ? 'Validando...' : 'Confirmar e fechar caixa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel sale dialog */}
      <Dialog open={!!saleToCancel} onOpenChange={open => { if (!open) setSaleToCancel(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar venda</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motivo do cancelamento</Label>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Informe o motivo para deixar registrado..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleToCancel(null)}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancelSale}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Open cash dialog */}
      <Dialog open={showOpenCashDialog} onOpenChange={() => undefined}>
        <DialogContent
          onEscapeKeyDown={event => event.preventDefault()}
          onPointerDownOutside={event => event.preventDefault()}
        >
          <DialogHeader><DialogTitle>Abrir caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o valor inicial para liberar o PDV.</p>
            <div className="space-y-1">
              <Label>Valor de abertura</Label>
              <Input
                autoFocus
                type="number"
                step="0.01"
                value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleOpenCash();
                  }
                }}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate('/')}>Voltar ao menu</Button>
            <Button onClick={handleOpenCash}>Abrir caixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close cash receipt dialog */}
      <Dialog open={showCloseCashReceipt} onOpenChange={setShowCloseCashReceipt}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
          <DialogHeader><DialogTitle>Recibo de fechamento do caixa</DialogTitle></DialogHeader>
          {lastCloseReceipt && (
            <div className="max-h-[70vh] overflow-auto space-y-3 text-sm">
              <div
                className={`rounded-lg border p-3 ${
                  closeCashEmailStatus === 'sent'
                    ? 'border-primary/30 bg-primary/5'
                    : closeCashEmailStatus === 'error'
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-border bg-secondary/20'
                }`}
              >
                <p className="font-semibold">
                  {closeCashEmailStatus === 'sending' && 'Enviando relatório por e-mail...'}
                  {closeCashEmailStatus === 'sent' && closeCashLastSentChannel === 'whatsapp' && 'Recibo preparado para envio pelo WhatsApp.'}
                  {closeCashEmailStatus === 'sent' && closeCashLastSentChannel !== 'whatsapp' && 'Relatório enviado por e-mail.'}
                  {closeCashEmailStatus === 'error' && closeCashLastSentChannel === 'whatsapp' && 'Falha ao preparar o envio pelo WhatsApp.'}
                  {closeCashEmailStatus === 'error' && closeCashLastSentChannel !== 'whatsapp' && 'Falha ao enviar o relatório por e-mail.'}
                  {closeCashEmailStatus === 'idle' && 'Escolha se deseja enviar o recibo por e-mail ou WhatsApp.'}
                </p>
                {closeCashEmailMessage && (
                  <p className="mt-1 text-xs text-muted-foreground">{closeCashEmailMessage}</p>
                )}
                {closeCashEmailRecipients.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Destino: {closeCashEmailRecipients.join(', ')}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border p-3">
                <p><strong>Aberto por:</strong> {lastCloseReceipt.openedBy} em {formatSaleDate(lastCloseReceipt.openedAt)}</p>
                <p><strong>Fechado por:</strong> {lastCloseReceipt.closedBy} em {formatSaleDate(lastCloseReceipt.closedAt)}</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Abertura</p>
                  <p className="font-bold">{formatMoney(lastCloseReceipt.openingAmount)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Vendas</p>
                  <p className="font-bold text-primary">{formatMoney(lastCloseReceipt.salesTotal)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Saídas</p>
                  <p className="font-bold text-destructive">{formatMoney(lastCloseReceipt.cashOutTotal)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Saldo final</p>
                  <p className="font-bold">{formatMoney(lastCloseReceipt.finalBalance)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 font-semibold">Entradas por venda ({lastCloseReceipt.saleCount})</p>
                <div className="space-y-1">
                  {lastCloseReceipt.sales.map(sale => (
                    <div key={sale.id} className="flex justify-between gap-3">
                      <span className="truncate">{formatSaleDate(sale.date)} | {formatPaymentMethod(sale.payment_method)}</span>
                      <span className="font-medium">{formatMoney(sale.total)}</span>
                    </div>
                  ))}
                  {lastCloseReceipt.sales.length === 0 && <p className="text-muted-foreground">Sem vendas nesta abertura.</p>}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 font-semibold">Saídas de caixa</p>
                <div className="space-y-1">
                  {lastCloseReceipt.cashOuts.map(expense => (
                    <div key={expense.id} className="flex justify-between gap-3">
                      <span className="truncate">{formatSaleDate(expense.date)} | {expense.description}</span>
                      <span className="font-medium text-destructive">{formatMoney(expense.amount)}</span>
                    </div>
                  ))}
                  {lastCloseReceipt.cashOuts.length === 0 && <p className="text-muted-foreground">Sem saídas nesta abertura.</p>}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={openCloseCashSendDialog}
              disabled={!lastCloseReceipt || closeCashEmailStatus === 'sending'}
            >
              {closeCashEmailStatus === 'sending' ? 'Enviando...' : 'Enviar recibo'}
            </Button>
            <Button variant="outline" onClick={handlePrintCloseCashReceipt}>Imprimir recibo</Button>
            <Button onClick={() => setShowCloseCashReceipt(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCloseCashSendDialog} onOpenChange={setShowCloseCashSendDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar recibo do fechamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha por qual via deseja enviar o recibo do fechamento do caixa.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={closeCashSendChannel === 'email' ? 'default' : 'outline'}
                onClick={() => setCloseCashSendChannel('email')}
              >
                Email
              </Button>
              <Button
                type="button"
                variant={closeCashSendChannel === 'whatsapp' ? 'default' : 'outline'}
                onClick={() => setCloseCashSendChannel('whatsapp')}
              >
                WhatsApp
              </Button>
            </div>

            {closeCashSendChannel === 'email' ? (
              <div className="space-y-1">
                <Label>Destino do e-mail</Label>
                <Input value={closeCashEmailDestination || 'Usuário logado sem e-mail'} readOnly />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>WhatsApp de destino</Label>
                <Input
                  value={closeCashWhatsappPhone}
                  onChange={event => setCloseCashWhatsappPhone(event.target.value)}
                  placeholder="(11) 99999-9999"
                />
                <p className="text-xs text-muted-foreground">
                  Você pode informar o número manualmente. O sistema vai reutilizar o último número digitado.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseCashSendDialog(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!lastCloseReceipt) return;
                if (closeCashSendChannel === 'email') {
                  void sendCloseCashReportEmail(lastCloseReceipt);
                  return;
                }
                sendCloseCashReportWhatsApp(lastCloseReceipt);
              }}
              disabled={closeCashSendChannel === 'email' && !closeCashEmailDestination}
            >
              {closeCashSendChannel === 'email' ? 'Enviar por e-mail' : 'Abrir no WhatsApp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent>
          <DialogHeader><DialogTitle>✅ Venda Finalizada!</DialogTitle></DialogHeader>
          {lastSaleData && (
            <div className="space-y-2 text-base">
              {lastSaleData.items.map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.product.name} x{i.quantity}</span>
                  <span>R$ {(i.product.price * i.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 font-bold flex justify-between">
                <span>Total</span><span>R$ {lastSaleData.total.toFixed(2)}</span>
              </div>
              {lastSaleData.change > 0 && (
                <p className="text-primary font-medium">Troco: R$ {lastSaleData.change.toFixed(2)}</p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReceipt(false)}>Fechar</Button>
            <Button onClick={sendReceiptWhatsApp}>📱 Enviar WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
