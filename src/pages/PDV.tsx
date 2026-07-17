import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { usePermissions } from '@/contexts/usePermissions';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ban, FileText, History, Loader2, Maximize2, Minimize2, Minus, Plus, Printer, Receipt, Search, ShoppingCart, Wallet, X } from 'lucide-react';
import type { Expense, Product, ProductPackaging, Reward, Sale } from '@/types';
import { INTERNET_REQUIRED_MESSAGE, isInternetUnavailable, openExternalUrl } from '@/lib/openExternalUrl';
import { normalizePhone } from '@/lib/phone';
import { openRetailCouponPrintWindow } from '@/lib/retailCoupon';
import { supabase } from '@/integrations/supabase/client';
import happyCashLogo from '@/assets/login/happycash.svg';
import { roleLabel } from '@/lib/access';
import { useCompanyDisplayName } from '@/hooks/use-company-display-name';
import { useStoreReceiptProfile } from '@/hooks/use-store-receipt-profile';
import { DEFAULT_COMPANY_NAME, resolveCompanyDisplayName } from '@/lib/company';
import { getAvailableClientCredit, getClientCreditLimit, getCreditLimitExceededMessage } from '@/lib/creditLimit';
import { enqueueOfflineOperation, isOfflineConcentratorAvailable } from '@/lib/offlineConcentrator';
import { verifyOfflineAdminAccess } from '@/lib/offlineAdminAccess';
import { readScopedCashSession, writeScopedCashSession, type ScopedCashSession } from '@/lib/cashSessionStorage';
import { parseDecimalInput, parseOptionalDecimalInput } from '@/lib/numberInput';
import { isExactProductSearchMatch, normalizeProductSearchText, toProductUppercase } from '@/lib/productSearch';
import { calculatePackagingPrice, filterProductsWithPackagings, findExactPackagingMatch, packagingMatchesSearch } from '@/lib/productPackaging';
import { findServiceTicketByLookup } from '@/lib/serviceTicket';
import { blocksSaleWithoutStock } from '@/lib/stockSalePolicy';
import { formatProductCode } from '@/lib/productCode';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { buildDesktopFiscalAccessPayload, canUseDesktopFiscalModule } from '@/lib/fiscalAccess';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';
import {
  type FiscalDocumentRecord,
  type FiscalRuntimeStatus,
  type ManageFiscalDocumentsResponse,
  buildFiscalDocumentHtml,
  fiscalStatusLabel,
  fiscalStatusVariant,
  normalizeFiscalDocumentRecord,
  normalizeFiscalRuntimeStatus,
  openFiscalDocumentPrintWindow,
} from '@/lib/fiscal';
import { formatCurrency, formatDateTime, formatPercent, getActiveLocale, translateCurrentText } from '../../shared/locale/format';

// Generated Supabase types are behind the current PDV schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  packagingId?: string | null;
  manualPrice?: boolean;
}

const getCartItemKey = (item: CartItem) => [
  item.product.id,
  item.packagingId ?? 'base',
  item.manualPrice ? `manual-${item.unitPrice}` : 'catalog',
].join(':');

interface PendingServiceTicketAdminAction {
  type: 'decrease' | 'remove';
  cartItem: CartItem;
}

type CashSession = ScopedCashSession;

interface CashCloseReceipt {
  openedAt: string;
  closedAt: string;
  openedBy: string;
  closedBy: string;
  openingAmount: number;
  salesTotal: number;
  cashOutTotal: number;
  finalBalance: number;
  expectedBalance: number;
  countedBalance: number;
  difference: number;
  differenceReason: string;
  saleCount: number;
  cashOuts: Expense[];
  sales: Sale[];
}

interface CashCloseEmailResponse {
  message?: string;
  recipients?: string[];
}

interface LastSaleReceiptData {
  saleId: string;
  saleDate: string;
  sellerName: string;
  items: CartItem[];
  total: number;
  discount: number;
  method: string;
  cashReceived: number;
  change: number;
  clientId: string | null;
  fiscalCustomerDocument: string | null;
  isDelivery: boolean;
  serviceTicketNumber: number | null;
  creditBalanceAfter: number | null;
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

const CLOSE_CASH_WHATSAPP_PHONE_KEY = 'happycash-close-cash-whatsapp-phone';
const CLOSE_CASH_EMAIL_RECIPIENTS_KEY = 'happycash-close-cash-email-recipients';
const PDV_CASHIER_MODE_KEY = 'happycash-pdv-cashier-mode';

const readCloseCashWhatsAppPhone = () => {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(CLOSE_CASH_WHATSAPP_PHONE_KEY) ?? '';
  } catch {
    return '';
  }
};

const readCloseCashEmailRecipients = () => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(CLOSE_CASH_EMAIL_RECIPIENTS_KEY) ?? '';
  } catch {
    return '';
  }
};

const parseEmailRecipients = (value: string) =>
  Array.from(new Set(
    value
      .split(/[,\n;]/)
      .map(item => item.trim())
      .filter(Boolean)
  ));

const isValidEmailRecipient = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const formatCpfCnpj = (value: string) => {
  const digits = digitsOnly(value).slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

const isCpfCnpjLength = (value: string) => {
  const digits = digitsOnly(value);
  return digits.length === 0 || digits.length === 11 || digits.length === 14;
};

const silentToast = {
  success: (message?: string) => message ? toast.success(message) : undefined,
  error: (message?: string) => message ? toast.error(message) : undefined,
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getPaymentMethodLabel = (value: string) => {
  switch (value) {
    case 'dinheiro':
      return translateCurrentText('Dinheiro');
    case 'pix':
      return 'Pix';
    case 'fiado':
      return translateCurrentText('Fiado');
    case 'cartao_debito':
      return translateCurrentText('Cartao debito');
    case 'cartao_credito':
      return translateCurrentText('Cartao credito');
    default:
      return value ? translateCurrentText(value) : translateCurrentText('Outros');
  }
};

const getPaymentBreakdown = (sales: Sale[]) => {
  const breakdown = new Map<string, PaymentBreakdownItem>();

  for (const sale of sales) {
    const key = sale.payment_method || 'outros';
    const label = getPaymentMethodLabel(key);
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

const CLOSE_CASH_PAYMENT_METHOD_ORDER = ['pix', 'cartao_debito', 'cartao_credito', 'dinheiro'] as const;

const getCloseCashPaymentSummary = (sales: Sale[]) => {
  const breakdown = getPaymentBreakdown(sales);
  const breakdownByKey = new Map(breakdown.map(item => [item.key, item]));
  const handledKeys = new Set<string>(CLOSE_CASH_PAYMENT_METHOD_ORDER);

  const orderedItems = CLOSE_CASH_PAYMENT_METHOD_ORDER.map(key => (
    breakdownByKey.get(key) ?? {
      key,
      label: getPaymentMethodLabel(key),
      total: 0,
      count: 0,
      sales: [],
    }
  ));

  const otherItems = breakdown.filter(item => !handledKeys.has(item.key));
  const otherTotal = otherItems.reduce((sum, item) => sum + item.total, 0);
  const otherCount = otherItems.reduce((sum, item) => sum + item.count, 0);

  if (otherTotal <= 0 && otherCount === 0) {
    return orderedItems;
  }

  return [
    ...orderedItems,
    {
      key: 'outros',
      label: translateCurrentText('Outros'),
      total: otherTotal,
      count: otherCount,
      sales: otherItems.flatMap(item => item.sales),
    },
  ];
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

const CREDIT_INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

const getPdvRewardLabel = (reward: Reward) => {
  const value = Number(reward.reward_value || 0);
  if (reward.reward_type === 'discount_percent') {
    return `${reward.name} (${value.toFixed(2)}%)`;
  }

  return `${reward.name} (${formatCurrency(value)})`;
};

export default function PDV() {
  const {
    products,
    productPackagings,
    blockSaleWithoutStock,
    clients,
    rewards,
    sales,
    saleItems,
    serviceTickets,
    serviceTicketItems,
    expenses,
    loading,
    createSale,
    addDebtEntries,
    addExpense,
    cancelSale,
    addServiceTicketItem,
    updateServiceTicketItemQuantity,
    cancelServiceTicketItem,
    updateServiceTicketStatus,
    getClientBalance,
    getClientTotalSpending,
  } = useData();
  const { user, username, session, role, ownerUserId, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { scope: operationalScope } = useOperationalScope();
  const operationalLocationId = operationalScope?.location.id ?? null;
  const operationalTerminalId = operationalScope?.terminal?.id ?? null;
  const { isDesktop, licensed: desktopLicensed, offlineEnabled, planId: desktopPlanId } = useDesktopRuntime();
  const navigate = useNavigate();
  const location = useLocation();
  const canUseDesktopOffline = isDesktop && offlineEnabled && isOfflineConcentratorAvailable();
  const desktopActivation = useMemo(() => readDesktopActivation(), []);
  const canUseFiscalModule = canUseDesktopFiscalModule({
    isDesktop,
    licensed: desktopLicensed,
    planId: desktopPlanId,
    activation: desktopActivation,
  });
  const canOpenCash = hasPermission('pdv.open_cash');
  const canCloseCash = hasPermission('pdv.close_cash');
  const canCashOut = hasPermission('pdv.cash_out');
  const canCancelSale = hasPermission('pdv.cancel_sale');
  const canEditPdvPrice = hasPermission('pdv.edit_price');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cashReceivedInputRef = useRef<HTMLInputElement>(null);
  const checkoutDialogRef = useRef<HTMLDivElement | null>(null);
  const creditInstallmentsDialogRef = useRef<HTMLDivElement | null>(null);
  const finalizeConfirmDialogRef = useRef<HTMLDivElement | null>(null);
  const scannerNotFoundDialogRef = useRef<HTMLDivElement | null>(null);
  const closeServiceTicketExitCancelRef = useRef<HTMLButtonElement | null>(null);
  const finalizeLockRef = useRef(false);
  const lastCheckoutModalScannerKeyAtRef = useRef(0);
  const lastScannerNotFoundKeyAtRef = useRef(0);
  const scannerBufferRef = useRef('');
  const scannerLastKeyAtRef = useRef(0);
  const scannerCharCountRef = useRef(0);
  const lastPointerProductAddRef = useRef<{ productId: string; at: number } | null>(null);
  const cartItemSelectionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const productsGridRef = useRef<HTMLDivElement | null>(null);
  const productSelectionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [search, setSearch] = useState('');
  const [cashierMode, setCashierMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(PDV_CASHIER_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(-1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartQuantityDrafts, setCartQuantityDrafts] = useState<Record<string, string>>({});
  const [activeServiceTicketId, setActiveServiceTicketId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'products' | 'cart'>('products');
  const [cartKeyboardSelectionIndex, setCartKeyboardSelectionIndex] = useState<number | null>(null);
  const [cartItemPendingRemoval, setCartItemPendingRemoval] = useState<CartItem | null>(null);
  const [cartItemPendingPriceEdit, setCartItemPendingPriceEdit] = useState<CartItem | null>(null);
  const [pendingCartItemPrice, setPendingCartItemPrice] = useState('');
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');
  const [discountInput, setDiscountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [fiscalCustomerDocument, setFiscalCustomerDocument] = useState('');
  const [selectedRewardId, setSelectedRewardId] = useState<string>('');
  const [isDelivery, setIsDelivery] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const isMobile = useIsMobile();
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [showCreditInstallmentsDialog, setShowCreditInstallmentsDialog] = useState(false);
  const [showScannerNotFoundDialog, setShowScannerNotFoundDialog] = useState(false);
  const [showCloseServiceTicketExitPrompt, setShowCloseServiceTicketExitPrompt] = useState(false);
  const [pendingServiceTicketLookup, setPendingServiceTicketLookup] = useState<string | null>(null);
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
  const [creditInstallments, setCreditInstallments] = useState<number | null>(null);
  const [pendingCreditInstallments, setPendingCreditInstallments] = useState(1);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashSessionLoading, setCashSessionLoading] = useState(true);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openCashAdminLogin, setOpenCashAdminLogin] = useState('');
  const [openCashAdminSecret, setOpenCashAdminSecret] = useState('');
  const [openCashAuthError, setOpenCashAuthError] = useState('');
  const [showCloseCashReceipt, setShowCloseCashReceipt] = useState(false);
  const [showCloseCashAuth, setShowCloseCashAuth] = useState(false);
  const [showCloseCashSendDialog, setShowCloseCashSendDialog] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [countedClosingBalance, setCountedClosingBalance] = useState('');
  const [closingDifferenceReason, setClosingDifferenceReason] = useState('');
  const [closeCashAuthError, setCloseCashAuthError] = useState('');
  const [closeCashEmailStatus, setCloseCashEmailStatus] = useState<CloseCashEmailStatus>('idle');
  const [closeCashEmailMessage, setCloseCashEmailMessage] = useState('');
  const [scannerNotFoundMessage, setScannerNotFoundMessage] = useState('Produto ou comanda nao encontrado.');
  const [closeCashEmailRecipients, setCloseCashEmailRecipients] = useState<string[]>([]);
  const [closeCashEmailRecipientInput, setCloseCashEmailRecipientInput] = useState(() => readCloseCashEmailRecipients());
  const [closeCashSendChannel, setCloseCashSendChannel] = useState<CloseCashSendChannel>('email');
  const [closeCashLastSentChannel, setCloseCashLastSentChannel] = useState<CloseCashSendChannel | null>(null);
  const [closeCashWhatsappPhone, setCloseCashWhatsappPhone] = useState(() => readCloseCashWhatsAppPhone());
  const [isVerifyingAdminPassword, setIsVerifyingAdminPassword] = useState(false);
  const [isVerifyingOpenCashAdmin, setIsVerifyingOpenCashAdmin] = useState(false);
  const [lastCloseReceipt, setLastCloseReceipt] = useState<CashCloseReceipt | null>(null);
  const [lastSaleData, setLastSaleData] = useState<LastSaleReceiptData | null>(null);
  const [isFinalizingSale, setIsFinalizingSale] = useState(false);
  const [fiscalRuntime, setFiscalRuntime] = useState<FiscalRuntimeStatus | null>(null);
  const [loadingFiscalRuntime, setLoadingFiscalRuntime] = useState(true);
  const [fiscalRuntimeError, setFiscalRuntimeError] = useState('');
  const [issuingFiscalDocument, setIssuingFiscalDocument] = useState(false);
  const [lastFiscalDocument, setLastFiscalDocument] = useState<FiscalDocumentRecord | null>(null);
  const [lastFiscalDocumentError, setLastFiscalDocumentError] = useState('');
  const [pendingServiceTicketAdminAction, setPendingServiceTicketAdminAction] = useState<PendingServiceTicketAdminAction | null>(null);
  const [serviceTicketAdminLogin, setServiceTicketAdminLogin] = useState('');
  const [serviceTicketAdminSecret, setServiceTicketAdminSecret] = useState('');
  const [serviceTicketAdminAuthError, setServiceTicketAdminAuthError] = useState('');
  const [isVerifyingServiceTicketAdmin, setIsVerifyingServiceTicketAdmin] = useState(false);
  const lastEscToClearCartAtRef = useRef(0);
  const ignoreCartClearOnEscRef = useRef(false);
  const loadedServiceTicketQueryRef = useRef<string | null>(null);
  const fiscalIssuanceSaleIdRef = useRef<string | null>(null);
  const companyDisplayName = useCompanyDisplayName();
  const receiptProfile = useStoreReceiptProfile();

  const activeProducts = products.filter(p => !p.deleted);
  const activeClients = clients.filter(c => !c.deleted);
  const sellerName = username || user?.email || translateCurrentText('Vendedor');
  const roleName = roleLabel[role];
  const activeServiceTicket = activeServiceTicketId
    ? serviceTickets.find(ticket => ticket.id === activeServiceTicketId) ?? null
    : null;
  const activeServiceTicketItems = useMemo(
    () => activeServiceTicket
      ? serviceTicketItems.filter(item => item.ticket_id === activeServiceTicket.id && item.status === 'active')
      : [],
    [activeServiceTicket, serviceTicketItems],
  );
  const buildCartFromServiceTicketItems = useCallback((ticketId: string) => {
    const groupedItems = new Map<string, CartItem>();
    const missingItems: string[] = [];

    const ticketItems = serviceTicketItems
      .filter(item => item.ticket_id === ticketId && item.status === 'active')
      .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

    for (const item of ticketItems) {
      const product = products.find(currentProduct => currentProduct.id === item.product_id);
      if (!product) {
        missingItems.push(item.product_name);
        continue;
      }

      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || product.price);
      if (quantity <= 0) continue;

      const key = `${product.id}:${unitPrice.toFixed(2)}`;
      const existing = groupedItems.get(key);
      if (existing) {
        existing.quantity += quantity;
        continue;
      }

      groupedItems.set(key, {
        product,
        quantity,
        unitPrice,
      });
    }

    return {
      cart: Array.from(groupedItems.values()),
      missingItems,
    };
  }, [products, serviceTicketItems]);
  const getMatchingActiveServiceTicketItems = useCallback((cartItem: CartItem) => {
    if (!activeServiceTicket) return [];

    return activeServiceTicketItems
      .filter(item =>
        item.status === 'active'
        && item.product_id === cartItem.product.id
        && Math.abs(Number(item.unit_price || 0) - cartItem.unitPrice) <= 0.009
      )
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }, [activeServiceTicket, activeServiceTicketItems]);

  const resetScannerTracking = useCallback(() => {
    scannerBufferRef.current = '';
    scannerLastKeyAtRef.current = 0;
    scannerCharCountRef.current = 0;
  }, []);

  const registerScannerLikeKey = useCallback((key: string, options?: { updateSearch?: boolean }) => {
    const updateSearch = options?.updateSearch ?? false;
    const now = Date.now();
    const isContinuation = now - scannerLastKeyAtRef.current <= 120;
    const nextBuffer = isContinuation
      ? `${scannerBufferRef.current}${key}`
      : key;

    scannerBufferRef.current = nextBuffer;
    scannerLastKeyAtRef.current = now;
    scannerCharCountRef.current = isContinuation ? scannerCharCountRef.current + 1 : 1;

    if (updateSearch) {
      setSearch(nextBuffer);
      setSearchSelectedIndex(-1);
    }
  }, []);

  const isLikelyScannerSubmit = useCallback(() => (
    scannerCharCountRef.current >= 3 && Date.now() - scannerLastKeyAtRef.current <= 180
  ), []);

  const formatMoney = (value: number) => formatCurrency(value);
  const getCartItemPricing = (item: CartItem) => item.manualPrice
    ? {
        total: item.unitPrice * item.quantity,
        effectiveUnitPrice: item.unitPrice,
        totalCost: (item.product.cost_price || 0) * item.quantity,
        effectiveUnitCost: item.product.cost_price || 0,
        packaging: null,
        packageCount: 0,
        remainderQuantity: item.quantity,
      }
    : calculatePackagingPrice(item.product, item.quantity, productPackagings, item.packagingId);
  const getCartItemTotal = (item: CartItem) => getCartItemPricing(item).total;
  const isCartItemPriceEdited = (item: CartItem) => Boolean(item.manualPrice);
  const formatSaleDate = (value: string) => formatDateTime(value);
  const formatPaymentMethod = (value: string) => getPaymentMethodLabel(value);
  const closeCashEmailDestination = user?.email?.trim() || '';
  const retailCouponStoreName = resolveCompanyDisplayName(
    receiptProfile.storeName !== DEFAULT_COMPANY_NAME ? receiptProfile.storeName : null,
    companyDisplayName !== DEFAULT_COMPANY_NAME ? companyDisplayName : null,
    fiscalRuntime?.issuerName,
    lastFiscalDocument?.payload?.issuer?.tradeName,
    lastFiscalDocument?.payload?.issuer?.legalName,
    DEFAULT_COMPANY_NAME,
  );

  const buildCloseCashWhatsAppMessage = (receipt: CashCloseReceipt) => {
    const paymentLines = getCloseCashPaymentSummary(receipt.sales).map(item =>
      `• ${item.label}: ${formatMoney(item.total)}`
    );

    const cashOutLines = receipt.cashOuts.length > 0
      ? receipt.cashOuts.map(expense => `• ${expense.description}: ${formatMoney(expense.amount)}`)
      : ['Sem saídas nesta abertura.'];

    return [
      `*${retailCouponStoreName} - Fechamento do Caixa*`,
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
      'Saídas de caixa',
      `Total: ${formatMoney(receipt.cashOutTotal)}`,
      ...cashOutLines,
    ].join('\n');
  };

  const getCloseCashEmailErrorMessage = async (error: unknown) => {
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.json();
        if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
          return getPublicErrorMessage(payload.error, 'O servidor recusou o envio do relatório por e-mail.');
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
      return getPublicErrorMessage(error, 'Não foi possível enviar o relatório por e-mail.');
    }

    return 'Não foi possível enviar o relatório por e-mail.';
  };

  const getFiscalFunctionErrorMessage = useCallback(async (
    error: unknown,
    fallbackMessage: string,
    data?: ManageFiscalDocumentsResponse | null,
  ) => {
    let resolvedMessage = data?.error || fallbackMessage;
    let missingItems = data?.missingItems ?? [];

    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.clone().json() as ManageFiscalDocumentsResponse & { message?: string };
        resolvedMessage = payload.error || payload.message || resolvedMessage;
        missingItems = payload.missingItems ?? missingItems;
      } catch {
        if (error.context.status === 401) {
          resolvedMessage = 'Sua sessao expirou. Entre novamente para emitir a NFC-e.';
        } else if (error.context.status === 404) {
          resolvedMessage = 'A funcao fiscal ainda nao foi publicada no servidor.';
        }
      }
    } else if (error instanceof FunctionsRelayError) {
      resolvedMessage = 'Nao foi possivel encaminhar a solicitacao para a funcao fiscal.';
    } else if (error instanceof FunctionsFetchError) {
      resolvedMessage = 'Nao foi possivel conectar ao servico fiscal agora.';
    } else if (error instanceof Error && error.message.trim()) {
      resolvedMessage = getPublicErrorMessage(error, fallbackMessage);
    }

    if (missingItems.length > 0) {
      return `${getPublicErrorMessage(resolvedMessage, fallbackMessage)} Pendencias: ${missingItems.join(', ')}.`;
    }

    return getPublicErrorMessage(resolvedMessage, fallbackMessage);
  }, []);

  const getAdminVerificationErrorMessage = useCallback(async (
    error: unknown,
    fallbackMessage: string,
    data?: { error?: string } | null,
  ) => {
    let resolvedMessage = data?.error || fallbackMessage;

    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.clone().json() as { error?: string; message?: string };
        resolvedMessage = payload.error || payload.message || resolvedMessage;
      } catch {
        if (error.context.status === 400) {
          resolvedMessage = 'Informe login e senha do administrador.';
        } else if (error.context.status === 401) {
          resolvedMessage = 'Login ou senha do administrador invalidos.';
        } else if (error.context.status === 403) {
          resolvedMessage = 'A conta informada nao possui permissao de administrador nesta loja.';
        } else if (error.context.status === 429) {
          resolvedMessage = 'Muitas tentativas de validacao. Aguarde alguns instantes e tente novamente.';
        }
      }
    } else if (error instanceof FunctionsRelayError) {
      resolvedMessage = 'Nao foi possivel encaminhar a validacao para o servidor.';
    } else if (error instanceof FunctionsFetchError) {
      resolvedMessage = 'Nao foi possivel conectar ao servidor para validar o administrador.';
    } else if (error instanceof Error && error.message.trim()) {
      resolvedMessage = error.message;
    }

    return getPublicErrorMessage(resolvedMessage, fallbackMessage);
  }, []);

  const loadFiscalRuntime = useCallback(async () => {
    if (!canUseFiscalModule) {
      setFiscalRuntime(null);
      setFiscalRuntimeError('');
      setLoadingFiscalRuntime(false);
      return;
    }

    if (!session?.access_token) {
      setFiscalRuntime(null);
      setFiscalRuntimeError('');
      setLoadingFiscalRuntime(false);
      return;
    }

    setLoadingFiscalRuntime(true);
    setFiscalRuntimeError('');

    const { data, error } = await supabase.functions.invoke<ManageFiscalDocumentsResponse>('manage-fiscal-documents', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'runtime_status',
        ...buildDesktopFiscalAccessPayload(desktopActivation),
      },
    });

    if (error || !data?.success || !data.runtime) {
      setFiscalRuntime(null);
      setFiscalRuntimeError(await getFiscalFunctionErrorMessage(
        error,
        'Nao foi possivel carregar o status fiscal do PDV.',
        data,
      ));
      setLoadingFiscalRuntime(false);
      return;
    }

    setFiscalRuntime(normalizeFiscalRuntimeStatus(data.runtime as Record<string, unknown>));
    setLoadingFiscalRuntime(false);
  }, [canUseFiscalModule, desktopActivation, getFiscalFunctionErrorMessage, session?.access_token]);

  const archiveAndMaybePrintFiscalDocument = async (document: FiscalDocumentRecord) => {
    const html = buildFiscalDocumentHtml(document, { autoPrint: false });
    const metadata = {
      id: document.id,
      saleId: document.saleId,
      provider: document.provider ?? 'internal',
      status: document.status,
      environment: document.environment,
      series: document.series,
      number: document.number,
      accessKey: document.accessKey,
      protocol: document.protocol ?? null,
      emittedAt: document.emittedAt,
      customer: document.payload?.customer ?? null,
      total: document.payload?.sale?.total ?? null,
    };

    if (fiscalRuntime?.danfeStoreLocally && typeof window !== 'undefined' && window.electronAPI?.fiscal?.archiveDocument) {
      const result = await window.electronAPI.fiscal.archiveDocument({ html, metadata });
      if (!result.success) {
        silentToast.error(result.error || 'NFC-e emitida, mas nao foi possivel arquivar o DANFE no computador.');
      }
    }

    if (fiscalRuntime?.danfeAutoPrint && typeof window !== 'undefined' && typeof window.electronAPI?.printHtml === 'function') {
      const printed = await window.electronAPI.printHtml(html);
      if (!printed) {
        silentToast.error('NFC-e emitida, mas nao foi possivel imprimir o DANFE automaticamente.');
      }
    }
  };

  const issueFiscalDocumentInHomologation = async (saleId: string) => {
    fiscalIssuanceSaleIdRef.current = saleId;

    if (!canUseFiscalModule) {
      if (fiscalIssuanceSaleIdRef.current === saleId) {
        setLastFiscalDocument(null);
        setLastFiscalDocumentError('A NFC-e esta disponivel somente no HappyCash Desktop PRO.');
        setIssuingFiscalDocument(false);
      }
      return;
    }

    if (!session?.access_token) {
      if (fiscalIssuanceSaleIdRef.current === saleId) {
        setLastFiscalDocument(null);
        setLastFiscalDocumentError('Sua sessao expirou. Entre novamente para emitir a NFC-e.');
        setIssuingFiscalDocument(false);
      }
      return;
    }

    setIssuingFiscalDocument(true);
    setLastFiscalDocument(null);
    setLastFiscalDocumentError('');

    const { data, error } = await supabase.functions.invoke<ManageFiscalDocumentsResponse>('manage-fiscal-documents', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'issue_nfce_homologation',
        saleId,
        ...buildDesktopFiscalAccessPayload(desktopActivation),
      },
    });

    if (error || !data?.success || !data.document) {
      if (fiscalIssuanceSaleIdRef.current === saleId) {
        setLastFiscalDocument(null);
        setLastFiscalDocumentError(await getFiscalFunctionErrorMessage(
          error,
          'Nao foi possivel emitir a NFC-e desta venda.',
          data,
        ));
        setIssuingFiscalDocument(false);
      }
      void loadFiscalRuntime();
      return;
    }

    if (fiscalIssuanceSaleIdRef.current === saleId) {
      const normalizedDocument = normalizeFiscalDocumentRecord(data.document as Record<string, unknown>);
      setLastFiscalDocument(normalizedDocument);
      setIssuingFiscalDocument(false);
      void archiveAndMaybePrintFiscalDocument(normalizedDocument);
    }
    void loadFiscalRuntime();
  };

  useEffect(() => {
    void loadFiscalRuntime();
  }, [loadFiscalRuntime]);

  useEffect(() => {
    let active = true;

    const syncCashSession = async () => {
      if (!user || !ownerUserId) {
        if (active) {
          setCashSession(null);
          setCashSessionLoading(false);
        }
        return;
      }

      const storedSession = readScopedCashSession(ownerUserId, user.id);
      if (storedSession && active) {
        setCashSession(storedSession);
      }

      if (canUseDesktopOffline && typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (active) {
          setCashSession(storedSession);
          setCashSessionLoading(false);
        }
        return;
      }

      let openCashQuery = db
        .from('cash_sessions')
        .select(operationalLocationId
          ? 'id, opened_at, opening_amount, opened_by_name, location_id, terminal_id'
          : 'id, opened_at, opening_amount, opened_by_name')
        .eq('owner_user_id', ownerUserId)
        .eq('operator_user_id', user.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });
      if (operationalLocationId) {
        openCashQuery = openCashQuery.eq('location_id', operationalLocationId);
      }
      const { data, error } = await openCashQuery
        .limit(1)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error('Erro ao sincronizar caixa aberto:', getRedactedLogValue(error));
        if (storedSession) {
          setCashSession(storedSession);
        }
        setCashSessionLoading(false);
        return;
      }

      if (!data) {
        setCashSession(null);
        writeScopedCashSession(ownerUserId, user.id, null);
        setCashSessionLoading(false);
        return;
      }

      const nextSession: CashSession = {
        id: data.id,
        openedAt: data.opened_at,
        openingAmount: Number(data.opening_amount || 0),
        openedBy: data.opened_by_name,
        ownerUserId,
        operatorUserId: user.id,
        locationId: data.location_id ?? operationalLocationId,
        terminalId: data.terminal_id ?? operationalTerminalId,
      };

      setCashSession(nextSession);
      writeScopedCashSession(ownerUserId, user.id, nextSession);
      setCashSessionLoading(false);
    };

    void syncCashSession();

    return () => {
      active = false;
    };
  }, [canUseDesktopOffline, operationalLocationId, operationalTerminalId, ownerUserId, user]);

  useEffect(() => {
    if (closeCashWhatsappPhone.trim()) return;

    const metadataPhone = typeof user?.user_metadata?.phone === 'string' ? user.user_metadata.phone : '';
    const nextPhone = user?.phone || metadataPhone || readCloseCashWhatsAppPhone();
    if (nextPhone) {
      setCloseCashWhatsappPhone(nextPhone);
    }
  }, [closeCashWhatsappPhone, user]);

  const isUnifiedServiceTicketQuery = useMemo(() => {
    const query = search.trim();
    if (!query) return false;
    return Boolean(findServiceTicketByLookup(serviceTickets, query));
  }, [search, serviceTickets]);
  const hasSearchQuery = search.trim().length > 0;
  const filtered = useMemo(() => {
    if (!hasSearchQuery) return [];
    return filterProductsWithPackagings(activeProducts, productPackagings, search);
  }, [activeProducts, hasSearchQuery, productPackagings, search]);
  const showIdleProductsState = (!hasSearchQuery || isUnifiedServiceTicketQuery) && cart.length === 0 && !activeServiceTicket;
  const showActiveEmptyTicketState = (!hasSearchQuery || isUnifiedServiceTicketQuery) && cart.length === 0 && Boolean(activeServiceTicket);
  const showProductResultsState = hasSearchQuery && !isUnifiedServiceTicketQuery && filtered.length > 0;
  const showProductNotFoundState = hasSearchQuery && !isUnifiedServiceTicketQuery && filtered.length === 0;

  useEffect(() => {
    try {
      window.localStorage.setItem(PDV_CASHIER_MODE_KEY, cashierMode ? 'true' : 'false');
    } catch {
      // Local persistence is only a convenience for the operator screen mode.
    }
  }, [cashierMode]);

  useEffect(() => {
    if (!isMobile || !cashierMode) return;

    setCashierMode(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, [cashierMode, isMobile]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setCashierMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleCashierMode = useCallback(() => {
    setCashierMode(current => {
      const next = !current;

      requestAnimationFrame(() => {
        const fullscreenAction = next
          ? document.documentElement.requestFullscreen?.()
          : document.fullscreenElement
            ? document.exitFullscreen?.()
            : undefined;

        if (fullscreenAction) {
          void fullscreenAction.catch(() => undefined);
        }
      });

      return next;
    });
  }, []);

  const scrollProductSelectionIntoView = useCallback((index: number, focusSelected = false) => {
    const syncScroll = () => {
      const container = productsGridRef.current;
      const selectedElement = productSelectionRefs.current[index];
      if (!container || !selectedElement) return;

      const containerRect = container.getBoundingClientRect();
      const selectedRect = selectedElement.getBoundingClientRect();
      const scrollPadding = 8;

      if (focusSelected) {
        selectedElement.focus({ preventScroll: true });
      }

      const selectedCenter =
        container.scrollTop + selectedRect.top - containerRect.top + selectedRect.height / 2;
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const centeredScrollTop = selectedCenter - container.clientHeight / 2;
      const nextScrollTop = Math.min(maxScrollTop, Math.max(0, centeredScrollTop - scrollPadding));

      container.scrollTo({
        top: Math.round(nextScrollTop),
        behavior: 'auto',
      });
    };

    requestAnimationFrame(() => {
      syncScroll();
      requestAnimationFrame(syncScroll);
    });
  }, []);

  useEffect(() => {
    if (filtered.length === 0) {
      setSearchSelectedIndex(-1);
      return;
    }

    setSearchSelectedIndex(currentIndex => {
      if (currentIndex >= 0 && currentIndex < filtered.length) {
        return currentIndex;
      }

      return search ? 0 : -1;
    });
  }, [filtered.length, search]);

  useEffect(() => {
    if (searchSelectedIndex < 0) return;

    const selectedElement = productSelectionRefs.current[searchSelectedIndex];
    if (!selectedElement) return;

    scrollProductSelectionIntoView(searchSelectedIndex);
  }, [searchSelectedIndex, filtered, scrollProductSelectionIntoView]);

  const subtotal = cart.reduce((s, i) => s + getCartItemTotal(i), 0);
  const cartUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const manualDiscountValue = parseDecimalInput(discountInput);
  const cashReceivedAmount = parseDecimalInput(cashReceived);
  const manualDiscount = discountType === 'percent'
    ? subtotal * manualDiscountValue / 100
    : manualDiscountValue;
  const selectedClientSpending = selectedClientId ? getClientTotalSpending(selectedClientId) : 0;
  const pdvEligibleRewards = useMemo(() => {
    if (!selectedClientId) return [];

    return rewards.filter(reward => {
      const type = reward.reward_type ?? 'gift';
      return reward.enabled !== false
        && reward.allow_pdv_redemption !== false
        && (type === 'discount_amount' || type === 'discount_percent')
        && selectedClientSpending >= Number(reward.minimum_spending || 0);
    });
  }, [rewards, selectedClientId, selectedClientSpending]);
  const selectedReward = pdvEligibleRewards.find(reward => reward.id === selectedRewardId) ?? null;
  const rewardDiscount = selectedReward
    ? selectedReward.reward_type === 'discount_percent'
      ? subtotal * (Number(selectedReward.reward_value || 0) / 100)
      : Number(selectedReward.reward_value || 0)
    : 0;
  const appliedManualDiscount = Math.min(subtotal, Math.max(0, manualDiscount));
  const appliedRewardDiscount = Math.min(Math.max(0, subtotal - appliedManualDiscount), Math.max(0, rewardDiscount));
  const discount = appliedManualDiscount + appliedRewardDiscount;
  const total = Math.max(0, subtotal - discount);
  const selectedClient = selectedClientId ? clients.find(client => client.id === selectedClientId) ?? null : null;
  const selectedClientBalance = selectedClientId ? getClientBalance(selectedClientId) : 0;
  const selectedClientCreditLimit = getClientCreditLimit(selectedClient);
  const selectedClientAvailableCredit = getAvailableClientCredit(selectedClient, selectedClientBalance);
  const fiadoExceedsCreditLimit = paymentMethod === 'fiado'
    && selectedClientCreditLimit !== null
    && total > (selectedClientAvailableCredit ?? 0) + 0.009;
  const shouldAskFiscalCustomerDocument = Boolean(
    canUseFiscalModule
    && fiscalRuntime?.enabled
    && fiscalRuntime.fiscalMode === 'nfce'
    && fiscalRuntime.consumerDocumentPromptEnabled,
  );
  const fiscalCustomerDocumentDigits = digitsOnly(fiscalCustomerDocument);
  const change = paymentMethod === 'dinheiro' ? Math.max(0, cashReceivedAmount - total) : 0;
  const canFinalizeCheckout = Boolean(paymentMethod)
    && (paymentMethod !== 'dinheiro' || cashReceivedAmount >= total)
    && (paymentMethod !== 'fiado' || Boolean(selectedClientId))
    && !fiadoExceedsCreditLimit
    && (paymentMethod !== 'cartao_credito' || Boolean(creditInstallments && creditInstallments > 0));
  const canIssueFiscalDocumentInHomologation = Boolean(
    canUseFiscalModule
    && isAdmin
    && session?.access_token
    && fiscalRuntime?.enabled
    && fiscalRuntime.fiscalMode === 'nfce'
    && fiscalRuntime.ready
    && fiscalRuntime.providerConfigured
    && (fiscalRuntime.provider === 'nuvem_fiscal' || fiscalRuntime.environment === 'homologacao'),
  );
  const checkoutFiscalBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = loadingFiscalRuntime
    ? 'outline'
    : fiscalRuntimeError
      ? 'destructive'
      : !fiscalRuntime?.enabled
        ? 'secondary'
        : fiscalRuntime.providerConfigured === false
          ? 'destructive'
          : fiscalRuntime.ready
            ? 'default'
            : 'destructive';
  const checkoutFiscalStatusLabel = loadingFiscalRuntime
    ? 'Carregando'
    : fiscalRuntimeError
      ? 'Falha'
      : !fiscalRuntime?.enabled
        ? 'Desativada'
        : fiscalRuntime.providerConfigured === false
          ? 'Credenciais'
        : fiscalRuntime.ready
          ? 'Pronta'
          : 'Pendente';

  useEffect(() => {
    if (!selectedRewardId) return;
    if (pdvEligibleRewards.some(reward => reward.id === selectedRewardId)) return;
    setSelectedRewardId('');
  }, [pdvEligibleRewards, selectedRewardId]);

  const saleSearchTerm = saleSearch.trim().toLowerCase();
  const isInCurrentCashSession = useCallback((value: string) => {
    if (!cashSession) return false;
    return new Date(value).getTime() >= new Date(cashSession.openedAt).getTime();
  }, [cashSession]);

  const sessionScopedSales = useMemo(() => {
    return sales.filter(sale => isInCurrentCashSession(sale.date));
  }, [isInCurrentCashSession, sales]);

  const visibleSales = useMemo(() => {
    return sessionScopedSales
      .filter(sale => {
        if (!saleSearchTerm) return true;
        const client = activeClients.find(c => c.id === sale.client_id);
        const saleCashReceived = Number(sale.cash_received || 0);
        const saleChangeAmount = Number(sale.change_amount || 0);
        return [
          sale.id,
          sale.payment_method,
          sale.seller_name || '',
          client?.name || '',
          formatSaleDate(sale.date),
          sale.total.toFixed(2),
          saleCashReceived.toFixed(2),
          saleChangeAmount.toFixed(2),
          sale.payment_method === 'dinheiro'
            ? `recebido ${saleCashReceived.toFixed(2)} troco ${saleChangeAmount.toFixed(2)}`
            : '',
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
                    <p class="payment-share-value">${escapeHtml(formatPercent(share))}%</p>
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
      <html lang="${escapeHtml(getActiveLocale())}">
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
                margin: 8mm;
              }

              html, body {
                background: #ffffff;
                width: 100%;
              }

              body {
                padding: 0;
              }

              .print-shell {
                width: 100%;
                max-width: none;
                margin: 0;
              }

              .receipt-sheet {
                border-radius: 0;
                border: none;
                box-shadow: none;
                overflow: visible;
              }

              .receipt-header {
                padding: 14mm 8mm 10mm;
              }

              .receipt-body {
                padding: 8mm 0 0;
              }

              .brand-badge {
                width: 72px;
                height: 72px;
                border-radius: 18px;
                box-shadow: none;
              }

              .brand-badge img {
                width: 48px;
                height: 48px;
              }

              .eyebrow {
                margin-top: 10px;
                font-size: 11px;
              }

              .receipt-title {
                margin-top: 8px;
                font-size: 24px;
              }

              .receipt-subtitle {
                margin-top: 8px;
                font-size: 12px;
                line-height: 1.45;
              }

              .top-grid,
              .tables-grid {
                grid-template-columns: 1fr;
                gap: 8px;
              }

              .metrics-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
              }

              .panel,
              .metric-card,
              .section-card,
              .table-card,
              .payment-card {
                border-radius: 12px;
                padding: 12px;
                page-break-inside: avoid;
                break-inside: avoid;
              }

              .panel-kicker,
              .metric-label,
              .section-kicker,
              .payment-chip,
              .payment-share-label,
              .table th {
                letter-spacing: 0.08em;
              }

              .responsible-line {
                font-size: 14px;
              }

              .responsible-date,
              .section-copy,
              .payment-meta {
                font-size: 11px;
                line-height: 1.45;
              }

              .dark-stat-label {
                font-size: 12px;
              }

              .dark-stat-value {
                font-size: 24px;
                overflow-wrap: anywhere;
              }

              .metric-value,
              .payment-total,
              .payment-share-value {
                font-size: 20px;
                overflow-wrap: anywhere;
              }

              .section-card,
              .table-card {
                margin-top: 8px;
              }

              .section-header,
              .payment-card-top,
              .payment-sale-row {
                align-items: stretch;
                flex-direction: column;
                gap: 8px;
              }

              .section-title {
                margin-top: 6px;
                font-size: 20px;
              }

              .section-title[style] {
                font-size: 20px !important;
              }

              .section-meta,
              .payment-sale-value,
              .table-value {
                white-space: normal;
              }

              .payment-stack,
              .payment-sales-list {
                gap: 8px;
                margin-top: 10px;
              }

              .payment-share {
                min-width: 0;
                padding: 10px;
              }

              .payment-sale-row {
                padding: 10px;
                border-radius: 12px;
              }

              .payment-sale-date {
                font-size: 12px;
              }

              .payment-sale-copy {
                font-size: 10px;
              }

              .payment-sale-value {
                font-size: 16px;
              }

              .table {
                table-layout: fixed;
                margin-top: 10px;
              }

              .table th {
                padding: 0 4px 6px;
                font-size: 9px;
              }

              .table td {
                padding: 8px 4px;
                font-size: 10px;
                line-height: 1.35;
                overflow-wrap: anywhere;
                word-break: break-word;
              }

              .table th:nth-child(1),
              .table td:nth-child(1) {
                width: 38%;
              }

              .table th:nth-child(2),
              .table td:nth-child(2) {
                width: 36%;
              }

              .table th:nth-child(3),
              .table td:nth-child(3) {
                width: 26%;
              }

              .table-value {
                font-size: 12px;
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
  }, [expenses, isInCurrentCashSession]);

  const cashSalesTotal = cashSessionSales
    .reduce((sum, sale) => sum + sale.total, 0);
  const cashOutTotal = cashSessionCashOuts
    .reduce((sum, expense) => sum + expense.amount, 0);
  const cashOpeningAmount = cashSession?.openingAmount || 0;
  const currentCashBalance = cashOpeningAmount + cashSalesTotal - cashOutTotal;
  const countedClosingValue = parseOptionalDecimalInput(countedClosingBalance);
  const closingDifference = (countedClosingValue ?? currentCashBalance) - currentCashBalance;
  const parsedCashOutAmount = parseOptionalDecimalInput(cashOutAmount);
  const cashOutAmountValue = parsedCashOutAmount ?? 0;
  const cashOutExceedsBalance = cashOutAmountValue > currentCashBalance;
  const showOpenCashDialog = !cashSession && !showCloseCashReceipt && !cashSessionLoading;
  const currentCloseCashPaymentSummary = useMemo(
    () => getCloseCashPaymentSummary(cashSessionSales),
    [cashSessionSales],
  );
  const closeCashReceiptPaymentSummary = useMemo(
    () => lastCloseReceipt ? getCloseCashPaymentSummary(lastCloseReceipt.sales) : [],
    [lastCloseReceipt],
  );
  const getCartQuantityForProduct = useCallback((productId: string) =>
    cart
      .filter(item => item.product.id === productId)
      .reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const getInsufficientStockMessage = useCallback((product: Product, requestedQuantity: number) => {
    if (!blocksSaleWithoutStock(product, blockSaleWithoutStock)) return '';
    const availableStock = Number(product.stock || 0);
    return availableStock < requestedQuantity
      ? `Estoque insuficiente para ${product.name}. Disponivel: ${availableStock}, solicitado: ${requestedQuantity}.`
      : '';
  }, [blockSaleWithoutStock]);
  const setCartQuantityDraft = useCallback((item: CartItem, quantity: number) => {
    setCartQuantityDrafts((current) => ({
      ...current,
      [getCartItemKey(item)]: String(quantity),
    }));
  }, []);
  const clearCartQuantityDrafts = useCallback(() => {
    setCartQuantityDrafts({});
  }, []);
  const commitCartQuantityInput = useCallback((item: CartItem, rawValue: string) => {
    if (activeServiceTicket) {
      setCartQuantityDraft(item, item.quantity);
      return;
    }

    const sanitized = rawValue.replace(/[^\d]/g, '');
    if (!sanitized) {
      setCartQuantityDraft(item, item.quantity);
      return;
    }

    const parsedQuantity = Number.parseInt(sanitized, 10);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      setCartQuantityDraft(item, item.quantity);
      return;
    }

    const otherQuantity = getCartQuantityForProduct(item.product.id) - item.quantity;
    const requestedTotal = otherQuantity + parsedQuantity;
    const stockMessage = getInsufficientStockMessage(item.product, requestedTotal);
    let nextQuantity = parsedQuantity;

    if (stockMessage) {
      const availableForItem = Math.max(1, Number(item.product.stock || 0) - otherQuantity);
      nextQuantity = availableForItem;
      silentToast.error(stockMessage);
    }

    setCart(prev => prev.map(currentItem =>
      currentItem === item ? { ...currentItem, quantity: nextQuantity } : currentItem
    ));
    setCartQuantityDraft(item, nextQuantity);
  }, [activeServiceTicket, getCartQuantityForProduct, getInsufficientStockMessage, setCartQuantityDraft]);
  const validateCartStock = () => {
    const productIds = new Set(cart.map(item => item.product.id));
    for (const productId of productIds) {
      const fallback = cart.find(item => item.product.id === productId)?.product;
      const product = products.find(currentProduct => currentProduct.id === productId) ?? fallback;
      if (!product) continue;
      const message = getInsufficientStockMessage(product, getCartQuantityForProduct(productId));
      if (message) {
        silentToast.error(message);
        return false;
      }
    }

    return true;
  };

  const findServiceTicket = useCallback((value: string) => {
    return findServiceTicketByLookup(serviceTickets, value);
  }, [serviceTickets]);
  const pendingServiceTicketToOpen = pendingServiceTicketLookup
    ? findServiceTicket(pendingServiceTicketLookup)
    : null;

  const focusProductSearch = useCallback(() => {
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const blurPdvInputs = useCallback(() => {
    searchInputRef.current?.blur();
    cashReceivedInputRef.current?.blur();

    if (typeof document === 'undefined') return;

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  }, []);

  const openScannerNotFoundDialog = useCallback((message = 'Produto ou comanda nao encontrado.') => {
    blurPdvInputs();
    setSearch('');
    setSearchSelectedIndex(-1);
    setScannerNotFoundMessage(message);
    setShowScannerNotFoundDialog(true);
  }, [blurPdvInputs]);

  const closeScannerNotFoundDialog = useCallback(() => {
    lastScannerNotFoundKeyAtRef.current = 0;
    setShowScannerNotFoundDialog(false);
  }, []);

  useEffect(() => {
    if (showOpenCashDialog || showCheckout || showFinalizeConfirm || showCreditInstallmentsDialog || showScannerNotFoundDialog) {
      return;
    }

    const timerId = window.setTimeout(() => {
      if (document.activeElement === searchInputRef.current) {
        blurPdvInputs();
      }
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [blurPdvInputs, showCheckout, showCreditInstallmentsDialog, showFinalizeConfirm, showOpenCashDialog, showScannerNotFoundDialog]);

  const closeServiceTicketExitPrompt = useCallback(() => {
    setPendingServiceTicketLookup(null);
    setShowCloseServiceTicketExitPrompt(false);
  }, []);

  const loadServiceTicketToCart = useCallback((ticketLookupValue: string, options?: {
    showNotFoundModal?: boolean;
    bypassActiveTicketPrompt?: boolean;
  }) => {
    const showNotFoundModal = options?.showNotFoundModal ?? true;
    const bypassActiveTicketPrompt = options?.bypassActiveTicketPrompt ?? false;

    if (role !== 'operator' && role !== 'admin') {
      silentToast.error('Somente operador ou administrador podem finalizar comanda no PDV');
      return false;
    }

    const ticket = findServiceTicket(ticketLookupValue);
    if (!ticket) {
      if (showNotFoundModal) {
        openScannerNotFoundDialog();
      }
      return false;
    }

    if (ticket.status === 'closed' || ticket.status === 'cancelled') {
      silentToast.error('Esta comanda ja foi encerrada');
      return false;
    }

    const { cart: nextCart, missingItems } = buildCartFromServiceTicketItems(ticket.id);

    if (missingItems.length > 0) {
      openScannerNotFoundDialog(`Produto nao encontrado no cadastro: ${missingItems[0]}.`);
      return false;
    }

    if (activeServiceTicketId && activeServiceTicketId !== ticket.id && !bypassActiveTicketPrompt) {
      blurPdvInputs();
      setPendingServiceTicketLookup(ticketLookupValue);
      setShowCloseServiceTicketExitPrompt(true);
      return false;
    }

    setSearch('');
    setSearchSelectedIndex(-1);
    resetScannerTracking();
    clearCartQuantityDrafts();
    setCart(nextCart);
    setActiveServiceTicketId(ticket.id);
    setMobilePanel('cart');
    silentToast.success(
      nextCart.length > 0
        ? `Comanda ${ticket.number} carregada no caixa`
        : `Comanda ${ticket.number} aberta no caixa`
    );
    return true;
  }, [activeServiceTicketId, blurPdvInputs, buildCartFromServiceTicketItems, clearCartQuantityDrafts, findServiceTicket, openScannerNotFoundDialog, resetScannerTracking, role]);

  useEffect(() => {
    const query = new URLSearchParams(location.search).get('comanda')?.trim() || '';
    if (!query || loadedServiceTicketQueryRef.current === query) return;
    if (serviceTickets.length === 0 || products.length === 0) return;

    if (loadServiceTicketToCart(query, { showNotFoundModal: false })) {
      loadedServiceTicketQueryRef.current = query;
    }
  }, [loadServiceTicketToCart, location.search, products.length, serviceTickets.length]);

  useEffect(() => {
    if (!activeServiceTicketId) return;

    const { cart: nextCart } = buildCartFromServiceTicketItems(activeServiceTicketId);
    clearCartQuantityDrafts();
    setCart(nextCart);
  }, [activeServiceTicketId, buildCartFromServiceTicketItems, clearCartQuantityDrafts]);

  const addToCart = useCallback(async (p: Product, packaging?: ProductPackaging | null) => {
    const addedQuantity = packaging?.base_quantity ?? 1;
    const requestedQuantity = getCartQuantityForProduct(p.id) + addedQuantity;
    const stockMessage = getInsufficientStockMessage(p, requestedQuantity);
    if (stockMessage) {
      silentToast.error(stockMessage);
      return false;
    }

    if (activeServiceTicket) {
      if (packaging) {
        silentToast.error('Embalagens comerciais ainda nao podem ser lancadas em comandas. Selecione a unidade do produto.');
        return false;
      }
      try {
        await addServiceTicketItem(activeServiceTicket.id, {
          productId: p.id,
          productName: p.name,
          quantity: addedQuantity,
          unitPrice: p.price,
          addedByName: sellerName,
        });
        searchInputRef.current?.blur();
        return true;
      } catch (error) {
        silentToast.error(error instanceof Error ? error.message : 'Nao foi possivel lancar o produto na comanda');
        return false;
      }
    }

    clearCartQuantityDrafts();
    setCart(prev => {
      const packagingId = packaging?.id ?? null;
      const existing = prev.find(i => i.product.id === p.id && (i.packagingId ?? null) === packagingId && !i.manualPrice);
      if (existing) return prev.map(i => i === existing ? {
        ...i,
        quantity: i.quantity + addedQuantity,
      } : i);
      return [...prev, {
        product: p,
        quantity: addedQuantity,
        unitPrice: p.price,
        packagingId: packaging?.id ?? null,
        manualPrice: false,
      }];
    });
    searchInputRef.current?.blur();
    return true;
  }, [activeServiceTicket, addServiceTicketItem, clearCartQuantityDrafts, getCartQuantityForProduct, getInsufficientStockMessage, sellerName]);

  const handleProductSelection = useCallback(async (product: Product, options?: { focusAfterSuccess?: boolean; packaging?: ProductPackaging | null }) => {
    const focusAfterSuccess = options?.focusAfterSuccess ?? true;
    const added = await addToCart(product, options?.packaging);
    if (!added) return false;

    setSearch('');
    setSearchSelectedIndex(-1);
    if (focusAfterSuccess) {
      focusProductSearch();
    }
    return true;
  }, [addToCart, focusProductSearch]);

  const handleProductPointerSelection = useCallback(async (event: ReactMouseEvent<HTMLElement>, product: Product) => {
    const now = Date.now();
    const lastPointerAdd = lastPointerProductAddRef.current;

    if (
      event.detail > 1
      || (lastPointerAdd && lastPointerAdd.productId === product.id && now - lastPointerAdd.at < 350)
    ) {
      event.preventDefault();
      return;
    }

    lastPointerProductAddRef.current = {
      productId: product.id,
      at: now,
    };

    const packaging = productPackagings.find((item) => item.product_id === product.id && packagingMatchesSearch(item, search)) ?? null;
    await handleProductSelection(product, { packaging });
  }, [handleProductSelection, productPackagings, search]);

  const addSearchResultToCart = useCallback(async (options?: {
    silentIfNotFound?: boolean;
    clearSearchOnNotFound?: boolean;
    query?: string;
    focusAfterSuccess?: boolean;
  }) => {
    const silentIfNotFound = options?.silentIfNotFound ?? false;
    const clearSearchOnNotFound = options?.clearSearchOnNotFound ?? false;
    const focusAfterSuccess = options?.focusAfterSuccess ?? true;
    const query = (options?.query ?? search).trim();
    const normalizedQuery = normalizeProductSearchText(query);
    const isPureNumericQuery = /^\d+$/.test(query);
    const matchingTicket = query ? findServiceTicket(query) : null;
    const exactPackaging = query ? findExactPackagingMatch(productPackagings, query) : null;
    const packagingProduct = exactPackaging
      ? activeProducts.find((product) => product.id === exactPackaging.product_id) ?? null
      : null;
    const exactProduct = query
      ? activeProducts.find(product => isExactProductSearchMatch(product, query))
      : null;
    const shouldOpenTicketFirst = Boolean(
      matchingTicket
      && (
        query.startsWith('HC')
        || (isPureNumericQuery && query.length <= 4)
      )
    );

    if (shouldOpenTicketFirst) {
      if (loadServiceTicketToCart(query, { showNotFoundModal: !silentIfNotFound })) {
        setSearch('');
        setSearchSelectedIndex(-1);
        resetScannerTracking();
        if (focusAfterSuccess) {
          focusProductSearch();
        }
      }
      return;
    }

    const selectedProduct = searchSelectedIndex >= 0 ? filtered[searchSelectedIndex] ?? null : null;
    const partialMatch = /[A-Z]/.test(normalizedQuery)
      ? selectedProduct ?? filtered[0] ?? null
      : selectedProduct;
    const product = packagingProduct ?? exactProduct ?? partialMatch;

    if (!product && matchingTicket) {
      if (loadServiceTicketToCart(query, { showNotFoundModal: !silentIfNotFound })) {
        setSearch('');
        setSearchSelectedIndex(-1);
        resetScannerTracking();
        if (focusAfterSuccess) {
          focusProductSearch();
        }
      }
      return;
    }

    if (!product) {
      if (clearSearchOnNotFound) {
        setSearch('');
        setSearchSelectedIndex(-1);
        resetScannerTracking();
      }
      if (!silentIfNotFound) {
        openScannerNotFoundDialog();
      }
      return;
    }

    const matchingPackaging = exactPackaging
      ?? productPackagings.find((packaging) => packaging.product_id === product.id && packagingMatchesSearch(packaging, query))
      ?? null;
    const added = await handleProductSelection(product, { focusAfterSuccess, packaging: matchingPackaging });
    if (!added) return;
    resetScannerTracking();
    silentToast.success(
      activeServiceTicket
        ? `${product.name} lancado na comanda ${activeServiceTicket.number}`
        : matchingPackaging
          ? `${matchingPackaging.name} adicionado (${matchingPackaging.base_quantity} unidades)`
          : `${product.name} adicionado`
    );
  }, [activeProducts, activeServiceTicket, filtered, findServiceTicket, focusProductSearch, handleProductSelection, loadServiceTicketToCart, openScannerNotFoundDialog, productPackagings, resetScannerTracking, search, searchSelectedIndex]);

  useEffect(() => {
    if (!cashierMode) return;
    if (
      showCheckout
      || showReceipt
      || showSalesSearch
      || showCancelledSales
      || showCashOut
      || showCloseCashReceipt
      || showOpenCashDialog
      || Boolean(saleToCancel)
      || Boolean(cartItemPendingPriceEdit)
      || Boolean(pendingServiceTicketAdminAction)
      || showFinalizeConfirm
      || showCreditInstallmentsDialog
    ) {
      return;
    }

    focusProductSearch();
  }, [
    cashierMode,
    cartItemPendingPriceEdit,
    focusProductSearch,
    pendingServiceTicketAdminAction,
    saleToCancel,
    showCancelledSales,
    showCashOut,
    showCheckout,
    showCloseCashReceipt,
    showCreditInstallmentsDialog,
    showFinalizeConfirm,
    showOpenCashDialog,
    showReceipt,
    showSalesSearch,
  ]);

  const moveSearchSelection = (backward = false) => {
    if (filtered.length === 0) return;

    setSearchSelectedIndex(currentIndex => {
      let nextIndex = 0;

      if (currentIndex < 0) {
        nextIndex = backward ? filtered.length - 1 : 0;
      } else if (backward) {
        nextIndex = (currentIndex - 1 + filtered.length) % filtered.length;
      } else {
        nextIndex = (currentIndex + 1) % filtered.length;
      }

      scrollProductSelectionIntoView(nextIndex, true);
      return nextIndex;
    });
  };

  const closePendingServiceTicketAdminAction = () => {
    setPendingServiceTicketAdminAction(null);
    setServiceTicketAdminLogin('');
    setServiceTicketAdminSecret('');
    setServiceTicketAdminAuthError('');
    setIsVerifyingServiceTicketAdmin(false);
  };

  const requestServiceTicketAdminAction = (action: PendingServiceTicketAdminAction) => {
    setPendingServiceTicketAdminAction(action);
    setServiceTicketAdminLogin('');
    setServiceTicketAdminSecret('');
    setServiceTicketAdminAuthError('');
  };

  const confirmServiceTicketAdminAction = async () => {
    if (!pendingServiceTicketAdminAction || !activeServiceTicket) return;

    setIsVerifyingServiceTicketAdmin(true);
    setServiceTicketAdminAuthError('');

    try {
      const authorization = await verifyAdminAuthorization({
        login: serviceTicketAdminLogin,
        secret: serviceTicketAdminSecret,
        setError: setServiceTicketAdminAuthError,
      });

      if (!authorization.ok) return;

      const matchingItems = getMatchingActiveServiceTicketItems(pendingServiceTicketAdminAction.cartItem);
      if (matchingItems.length === 0) {
        silentToast.error('Nao foi possivel localizar o item ativo da comanda.');
        closePendingServiceTicketAdminAction();
        return;
      }

      if (pendingServiceTicketAdminAction.type === 'decrease') {
        const targetItem = matchingItems[0];
        const currentQuantity = Number(targetItem.quantity || 0);
        if (currentQuantity > 1) {
          await updateServiceTicketItemQuantity(targetItem.id, currentQuantity - 1, { skipAdminCheck: true });
        } else {
          await cancelServiceTicketItem(
            targetItem.id,
            'Quantidade reduzida no PDV por administrador.',
            sellerName,
            { skipAdminCheck: true },
          );
        }

        silentToast.success(`Quantidade de ${pendingServiceTicketAdminAction.cartItem.product.name} reduzida na comanda ${activeServiceTicket.number}`);
      } else {
        for (const item of matchingItems) {
          await cancelServiceTicketItem(
            item.id,
            'Item removido no PDV por administrador.',
            sellerName,
            { skipAdminCheck: true },
          );
        }

        silentToast.success(`${pendingServiceTicketAdminAction.cartItem.product.name} removido da comanda ${activeServiceTicket.number}`);
      }

      closePendingServiceTicketAdminAction();
    } catch (error) {
      console.error('Erro ao validar ajuste de item da comanda:', getRedactedLogValue(error));
      setServiceTicketAdminAuthError(getPublicErrorMessage(error, 'Nao foi possivel validar o ajuste do item da comanda.'));
    } finally {
      setIsVerifyingServiceTicketAdmin(false);
    }
  };

  const updateQty = async (cartItem: CartItem, delta: number) => {
    if (activeServiceTicket) {
      if (delta > 0) {
        await addToCart(cartItem.product);
        return;
      }

      requestServiceTicketAdminAction({ type: 'decrease', cartItem });
      return;
    }

    if (delta > 0) {
      const stockMessage = getInsufficientStockMessage(
        cartItem.product,
        getCartQuantityForProduct(cartItem.product.id) + delta,
      );
      if (stockMessage) {
        silentToast.error(stockMessage);
        setCartQuantityDraft(cartItem, cartItem.quantity);
        return;
      }
    }

    clearCartQuantityDrafts();
    setCart(prev => prev.map(i => {
      if (i !== cartItem) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }));
  };

  const openCartItemPriceEditor = (item: CartItem) => {
    if (activeServiceTicket) {
      silentToast.error('Preco de item lancado em comanda nao pode ser alterado direto no PDV.');
      return;
    }

    if (!canEditPdvPrice) {
      silentToast.error('Seu usuario nao tem permissao para alterar preco no caixa');
      return;
    }

    setCartItemPendingPriceEdit(item);
    setPendingCartItemPrice(item.unitPrice.toFixed(2));
  };

  const startCartPriceSelection = () => {
    if (activeServiceTicket) {
      silentToast.error('Preco de item lancado em comanda nao pode ser alterado direto no PDV.');
      return;
    }

    if (!canEditPdvPrice) {
      silentToast.error('Seu usuario nao tem permissao para alterar preco no caixa');
      return;
    }

    if (cart.length === 0) {
      silentToast.error('Carrinho vazio');
      return;
    }

    setCartKeyboardSelectionIndex(currentIndex => {
      if (currentIndex !== null && currentIndex >= 0 && currentIndex < cart.length) {
        requestAnimationFrame(() => {
          cartItemSelectionRefs.current[currentIndex]?.focus();
        });
        return currentIndex;
      }

      return 0;
    });
  };

  const moveCartKeyboardSelection = (backward = false) => {
    if (cart.length === 0) {
      return;
    }

    setCartKeyboardSelectionIndex(currentIndex => {
      if (currentIndex === null) {
        return backward ? cart.length - 1 : 0;
      }

      if (backward) {
        return Math.max(0, currentIndex - 1);
      }

      return Math.min(cart.length - 1, currentIndex + 1);
    });
  };

  const openSelectedCartItemPriceEditor = () => {
    if (!canEditPdvPrice) {
      silentToast.error('Seu usuario nao tem permissao para alterar preco no caixa');
      return;
    }

    if (cart.length === 0) {
      silentToast.error('Carrinho vazio');
      return;
    }

    const selectedIndex = cartKeyboardSelectionIndex ?? 0;
    const selectedItem = cart[selectedIndex];
    if (!selectedItem) {
      return;
    }

    openCartItemPriceEditor(selectedItem);
  };

  const closeCartItemPriceEditor = useCallback(() => {
    setCartItemPendingPriceEdit(null);
    setPendingCartItemPrice('');
  }, []);

  const applyCartItemPriceChange = () => {
    if (!cartItemPendingPriceEdit) return;

    const parsedPrice = parseOptionalDecimalInput(pendingCartItemPrice);
    if (parsedPrice === null || parsedPrice < 0) {
      silentToast.error('Informe um preço válido');
      return;
    }

    const nextPrice = Math.round(parsedPrice * 100) / 100;
    clearCartQuantityDrafts();
    setCart(prev => prev.map(item =>
      item === cartItemPendingPriceEdit
        ? { ...item, unitPrice: nextPrice, manualPrice: true, packagingId: null }
        : item
    ));
    closeCartItemPriceEditor();
    silentToast.success('Preço atualizado');
  };

  const removeFromCart = (target: CartItem) => {
    setCartQuantityDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[getCartItemKey(target)];
      return nextDrafts;
    });
    setCart(prev => prev.filter(item => item !== target));
  };
  const requestRemoveFromCart = (item: CartItem) => {
    if (activeServiceTicket) {
      requestServiceTicketAdminAction({ type: 'remove', cartItem: item });
      return;
    }

    setCartItemPendingRemoval(item);
  };
  const confirmRemoveFromCart = () => {
    if (!cartItemPendingRemoval) return;
    removeFromCart(cartItemPendingRemoval);
    setCartItemPendingRemoval(null);
  };

  const clearCart = useCallback((options?: { skipToast?: boolean }) => {
    if (cart.length === 0 && !activeServiceTicketId) return;
    const wasViewingServiceTicket = Boolean(activeServiceTicketId);
    setCart([]);
    clearCartQuantityDrafts();
    setActiveServiceTicketId(null);
    setCartKeyboardSelectionIndex(null);
    closeCartItemPriceEditor();
    setCartItemPendingRemoval(null);
    lastEscToClearCartAtRef.current = 0;
    if (!options?.skipToast) {
      silentToast.success(wasViewingServiceTicket ? 'Comanda retirada da tela do PDV' : 'Carrinho zerado');
    }
    searchInputRef.current?.blur();
  }, [activeServiceTicketId, cart.length, clearCartQuantityDrafts, closeCartItemPriceEditor]);

  const confirmCloseServiceTicketView = useCallback(() => {
    const nextTicketLookup = pendingServiceTicketLookup;

    setPendingServiceTicketLookup(null);
    setShowCloseServiceTicketExitPrompt(false);

    if (nextTicketLookup) {
      clearCart({ skipToast: true });
      loadServiceTicketToCart(nextTicketLookup, { bypassActiveTicketPrompt: true });
      return;
    }

    clearCart();
  }, [clearCart, loadServiceTicketToCart, pendingServiceTicketLookup]);

  useEffect(() => {
    const blockDoubleActivation = (event: MouseEvent) => {
      if (event.detail <= 1) return;

      event.preventDefault();
      event.stopPropagation();

      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener('click', blockDoubleActivation, true);
    document.addEventListener('dblclick', blockDoubleActivation, true);

    return () => {
      document.removeEventListener('click', blockDoubleActivation, true);
      document.removeEventListener('dblclick', blockDoubleActivation, true);
    };
  }, []);

  useEffect(() => {
    if (cart.length === 0) {
      setCartKeyboardSelectionIndex(null);
      return;
    }

    setCartKeyboardSelectionIndex(currentIndex => {
      if (currentIndex === null) return null;
      return Math.min(currentIndex, cart.length - 1);
    });
  }, [cart.length]);

  useEffect(() => {
    if (cartKeyboardSelectionIndex === null) return;

    const selectedElement = cartItemSelectionRefs.current[cartKeyboardSelectionIndex];
    if (!selectedElement) return;

    selectedElement.focus();
    selectedElement.scrollIntoView({ block: 'nearest' });
  }, [cartKeyboardSelectionIndex, cart]);

  useEffect(() => {
    if (mobilePanel === 'cart' && cart.length === 0) {
      setMobilePanel('products');
    }
  }, [cart.length, mobilePanel]);

  useEffect(() => {
    if (
      showCheckout
      || showReceipt
      || showSalesSearch
      || showCancelledSales
      || showCashOut
      || showCloseCashReceipt
      || showOpenCashDialog
      || showCloseServiceTicketExitPrompt
      || Boolean(saleToCancel)
      || Boolean(cartItemPendingPriceEdit)
    ) {
      setCartKeyboardSelectionIndex(null);
    }
  }, [showCheckout, showReceipt, showSalesSearch, showCancelledSales, showCashOut, showCloseCashReceipt, showOpenCashDialog, showCloseServiceTicketExitPrompt, saleToCancel, cartItemPendingPriceEdit]);

  useEffect(() => {
    if (!showCheckout) return;

    blurPdvInputs();
    requestAnimationFrame(() => checkoutDialogRef.current?.focus());
  }, [blurPdvInputs, showCheckout]);

  useEffect(() => {
    if (!showCreditInstallmentsDialog) return;

    blurPdvInputs();
    requestAnimationFrame(() => creditInstallmentsDialogRef.current?.focus());
  }, [blurPdvInputs, showCreditInstallmentsDialog]);

  useEffect(() => {
    if (!showFinalizeConfirm) return;

    blurPdvInputs();
    requestAnimationFrame(() => finalizeConfirmDialogRef.current?.focus());
  }, [blurPdvInputs, showFinalizeConfirm]);

  useEffect(() => {
    if (!showScannerNotFoundDialog) return;

    blurPdvInputs();
    requestAnimationFrame(() => scannerNotFoundDialogRef.current?.focus());
  }, [blurPdvInputs, showScannerNotFoundDialog]);

  const suppressCartClearForCurrentEsc = () => {
    ignoreCartClearOnEscRef.current = true;
    requestAnimationFrame(() => {
      ignoreCartClearOnEscRef.current = false;
    });
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    if (method === 'cartao_credito') {
      setPendingCreditInstallments(creditInstallments ?? 1);
      setShowCreditInstallmentsDialog(true);
      requestAnimationFrame(() => {
        cashReceivedInputRef.current?.blur();
      });
      return;
    }

    if (creditInstallments !== null) {
      setCreditInstallments(null);
    }

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

  const confirmCreditInstallments = () => {
    const nextInstallments = Math.max(1, Math.min(12, pendingCreditInstallments || 1));
    setCreditInstallments(nextInstallments);
    setShowCreditInstallmentsDialog(false);
  };

  const closeCreditInstallmentsDialog = () => {
    setShowCreditInstallmentsDialog(false);
    if (paymentMethod === 'cartao_credito' && !creditInstallments) {
      setPaymentMethod('');
    }
  };

  const openCheckout = () => {
    if (!cashSession) { silentToast.error('Abra o caixa antes de vender'); return; }
    if (cart.length === 0) { silentToast.error('Carrinho vazio'); return; }
    if (!validateCartStock()) return;
    blurPdvInputs();
    setPaymentMethod('');
    setCreditInstallments(null);
    setPendingCreditInstallments(1);
    setCashReceived('');
    setSelectedClientId('');
    setFiscalCustomerDocument('');
    setSelectedRewardId('');
    setShowFinalizeConfirm(false);
    setShowCheckout(true);
  };

  const openCheckoutWithPayment = (method: string) => {
    if (!showCheckout) {
      if (!cashSession) { silentToast.error('Abra o caixa antes de vender'); return; }
      if (cart.length === 0) { silentToast.error('Carrinho vazio'); return; }
      if (!validateCartStock()) return;
      openCheckout();
    }

    handlePaymentMethodChange(method);
  };

  const requestFinalizeConfirmation = () => {
    if (paymentMethod === 'cartao_credito' && !creditInstallments) {
      setPendingCreditInstallments(1);
      setShowCreditInstallmentsDialog(true);
      return;
    }

    if (shouldAskFiscalCustomerDocument && !isCpfCnpjLength(fiscalCustomerDocument)) {
      silentToast.error('Informe CPF/CNPJ com 11 ou 14 digitos, ou deixe em branco.');
      return;
    }

    if (!canFinalizeCheckout || isFinalizingSale) return;
    setShowFinalizeConfirm(true);
  };

  const finalizeSale = async () => {
    if (!cashSession) { silentToast.error('Abra o caixa antes de vender'); return; }
    if (cart.length === 0) { silentToast.error('Carrinho vazio'); return; }
    if (!paymentMethod) return;
    if (finalizeLockRef.current) return;
    if (paymentMethod === 'dinheiro' && cashReceivedAmount < total) {
      silentToast.error('Valor recebido insuficiente'); return;
    }
    if (paymentMethod === 'fiado' && !selectedClientId) {
      silentToast.error('Selecione um cliente para fiado'); return;
    }
    if (paymentMethod === 'fiado' && selectedClient && selectedClientCreditLimit !== null && fiadoExceedsCreditLimit) {
      silentToast.error(getCreditLimitExceededMessage(selectedClient.name, selectedClientCreditLimit, selectedClientBalance, total));
      return;
    }
    if (shouldAskFiscalCustomerDocument && !isCpfCnpjLength(fiscalCustomerDocument)) {
      silentToast.error('Informe CPF/CNPJ com 11 ou 14 digitos, ou deixe em branco.');
      return;
    }
    if (!validateCartStock()) return;

    let reservedBrowserPrintWindow: Window | null = null;
    if (!canSilentPrintRetailCoupon && typeof window !== 'undefined') {
      reservedBrowserPrintWindow = window.open('', '_blank', 'width=420,height=900');
      if (reservedBrowserPrintWindow) {
        reservedBrowserPrintWindow.document.open();
        reservedBrowserPrintWindow.document.write(`
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Preparando cupom</title>
              <style>
                body {
                  margin: 0;
                  width: 80mm;
                  padding: 12mm 4mm;
                  color: #000;
                  font-family: Arial, Helvetica, sans-serif;
                  font-size: 14px;
                  font-weight: 700;
                  text-align: center;
                }
              </style>
            </head>
            <body>Preparando cupom...</body>
          </html>
        `);
        reservedBrowserPrintWindow.document.close();
      }
    }

    finalizeLockRef.current = true;
    setIsFinalizingSale(true);
    try {
      const items = cart.map(i => {
        const pricing = getCartItemPricing(i);
        return {
          product_id: i.product.id,
          product_code: i.product.code ?? null,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: pricing.effectiveUnitPrice,
          cost_price: pricing.effectiveUnitCost,
          total: pricing.total,
          packaging_id: pricing.packaging?.id ?? null,
          packaging_name: pricing.packaging?.name ?? null,
          packaging_quantity: pricing.packaging?.base_quantity ?? null,
          packaging_price: pricing.packaging?.sale_price ?? null,
        };
      });

      const { sale } = await createSale({
        client_id: selectedClientId || null,
        user_id: user!.id,
        operator_user_id: user!.id,
        cash_session_id: cashSession.id ?? null,
        seller_name: sellerName,
        is_delivery: isDelivery,
        service_ticket_number: activeServiceTicket?.number ?? null,
        status: 'completed',
        total,
        discount,
        payment_method: paymentMethod,
        cash_received: cashReceivedAmount,
        change_amount: change,
        fiscal_customer_document: fiscalCustomerDocumentDigits || null,
        fiscal_customer_name: fiscalCustomerDocumentDigits ? selectedClient?.name ?? null : null,
      }, items);

      // If fiado, create debt entries
      if (paymentMethod === 'fiado' && selectedClientId) {
        try {
          const debtFactor = subtotal > 0 ? total / subtotal : 1;
          await addDebtEntries(
            items.map(i => {
              const discountedTotal = Math.round(i.total * debtFactor * 100) / 100;
              const keepPackaging = Math.abs(debtFactor - 1) < 0.000001;
              return {
                clientId: selectedClientId,
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                unitPrice: discountedTotal / i.quantity,
                total: discountedTotal,
                packagingId: keepPackaging ? i.packaging_id : null,
                packagingName: keepPackaging ? i.packaging_name : null,
                packagingQuantity: keepPackaging ? i.packaging_quantity : null,
                packagingPrice: keepPackaging ? i.packaging_price : null,
                registeredBy: username || user?.email,
              };
            }),
            { adjustStock: false },
          );
        } catch (debtError) {
          console.error('Venda salva, mas nao foi possivel registrar o fiado:', getRedactedLogValue(debtError));
          silentToast.error('Venda finalizada; confira o fiado deste cliente.');
        }
      }

      if (activeServiceTicket) {
        try {
          await updateServiceTicketStatus(activeServiceTicket.id, 'closed', {
            saleId: sale.id,
            closedByName: sellerName,
          });
        } catch (ticketError) {
          console.error('Nao foi possivel fechar a comanda apos a venda:', getRedactedLogValue(ticketError));
          silentToast.error('Venda finalizada, mas nao foi possivel fechar a comanda automaticamente');
        }
      }

      const finalizedPaymentMethod = paymentMethod === 'cartao_credito' && creditInstallments
        ? `Cartão crédito (${creditInstallments}x)`
        : formatPaymentMethod(paymentMethod);

      const finalizedSaleData: LastSaleReceiptData = {
        saleId: sale.id,
        saleDate: sale.date,
        sellerName: sale.seller_name || sellerName,
        items: [...cart],
        total,
        discount,
        method: finalizedPaymentMethod,
        cashReceived: cashReceivedAmount,
        change,
        clientId: selectedClientId || null,
        fiscalCustomerDocument: fiscalCustomerDocumentDigits || null,
        isDelivery,
        serviceTicketNumber: activeServiceTicket?.number ?? null,
        creditBalanceAfter: paymentMethod === 'fiado' && selectedClientId
          ? selectedClientBalance + total
          : null,
      };

      setLastSaleData(finalizedSaleData);
      setLastFiscalDocument(null);
      setLastFiscalDocumentError('');
      setIssuingFiscalDocument(canIssueFiscalDocumentInHomologation);
      fiscalIssuanceSaleIdRef.current = canIssueFiscalDocumentInHomologation ? sale.id : null;
      setShowFinalizeConfirm(false);
      setShowCheckout(false);
      setShowReceipt(false);
      clearCartQuantityDrafts();
      setCart([]);
      setActiveServiceTicketId(null);
      setDiscountInput('');
      setPaymentMethod('');
      setCreditInstallments(null);
      setPendingCreditInstallments(1);
      setCashReceived('');
      setSelectedClientId('');
      setFiscalCustomerDocument('');
      setSelectedRewardId('');
      setIsDelivery(false);
      silentToast.success(translateCurrentText('Venda finalizada!'));

      try {
        if (canSilentPrintRetailCoupon) {
          const printed = await printSaleCouponFromData(finalizedSaleData, {
            preferSilentPrint: true,
            automaticPrint: true,
          });

          if (!printed) {
            setShowReceipt(true);
            silentToast.error('Nao foi possivel imprimir o cupom automaticamente.');
          }
        } else {
          const printed = await printSaleCouponFromData(finalizedSaleData, {
            automaticPrint: true,
            targetWindow: reservedBrowserPrintWindow,
          });

          if (!printed) {
            setShowReceipt(true);
            silentToast.error('Nao foi possivel abrir a tela de impressao do cupom.');
          }
        }
      } catch (printError) {
        console.error('Venda salva, mas a impressao automatica falhou:', getRedactedLogValue(printError));
        setShowReceipt(true);
        silentToast.error('Venda finalizada, mas a impressao automatica falhou.');
      }

      if (canIssueFiscalDocumentInHomologation) {
        void issueFiscalDocumentInHomologation(sale.id);
      }
    } catch (error) {
      if (reservedBrowserPrintWindow && !reservedBrowserPrintWindow.closed) {
        reservedBrowserPrintWindow.close();
      }
      const message = getPublicErrorMessage(error, translateCurrentText('Erro ao finalizar venda'));
      silentToast.error(message);
    } finally {
      finalizeLockRef.current = false;
      setIsFinalizingSale(false);
    }
  };

  const sendReceiptWhatsApp = () => {
    if (!lastSaleData?.clientId) return;
    const client = activeClients.find(c => c.id === lastSaleData.clientId);
    if (!client?.phone) { silentToast.error(translateCurrentText('Cliente sem telefone')); return; }
    if (isInternetUnavailable()) {
      silentToast.error(INTERNET_REQUIRED_MESSAGE);
      return;
    }

    const lines = lastSaleData.items.map(i => `• ${i.product.name} x${i.quantity} (${formatMoney(i.unitPrice)}) — ${formatMoney(getCartItemTotal(i))}`);
    const msg = `🧾 *${retailCouponStoreName} - ${translateCurrentText('Comprovante')}*\n\n${lines.join('\n')}\n\n${lastSaleData.discount > 0 ? `${translateCurrentText('Desconto')}: ${formatMoney(lastSaleData.discount)}\n` : ''}💰 *${translateCurrentText('Total')}: ${formatMoney(lastSaleData.total)}*\n📅 ${formatDateTime(new Date())}\n${translateCurrentText('Pagamento')}: ${lastSaleData.method}`;
    if (!openExternalUrl(`https://wa.me/${normalizePhone(client.phone)}?text=${encodeURIComponent(msg)}`)) {
      silentToast.error('Não foi possível abrir o WhatsApp.');
    }
  };

  const canSilentPrintRetailCoupon = typeof window !== 'undefined'
    && typeof window.electronAPI?.printHtml === 'function';

  const printSaleCouponFromData = async (
    saleReceiptData: LastSaleReceiptData,
    options?: {
      copyLabel?: string;
      preferSilentPrint?: boolean;
      automaticPrint?: boolean;
      targetWindow?: Window | null;
    },
  ) => {
    const client = saleReceiptData.clientId
      ? activeClients.find(item => item.id === saleReceiptData.clientId)
      : null;
    const subtotalValue = saleReceiptData.items.reduce((sum, item) => sum + getCartItemTotal(item), 0);

    return openRetailCouponPrintWindow({
      storeName: retailCouponStoreName,
      storeTaxId: receiptProfile.taxId,
      storeAddress: receiptProfile.address,
      storePhone: receiptProfile.phone,
      saleId: saleReceiptData.saleId,
      saleDate: saleReceiptData.saleDate,
      operatorName: saleReceiptData.sellerName || sellerName || null,
      customerName: client?.name || null,
      paymentMethod: saleReceiptData.method,
      total: saleReceiptData.total,
      subtotal: subtotalValue,
      discount: saleReceiptData.discount,
      changeAmount: saleReceiptData.change,
      cashReceived: saleReceiptData.cashReceived,
      isDelivery: saleReceiptData.isDelivery,
      serviceTicketNumber: saleReceiptData.serviceTicketNumber,
      creditBalanceAfter: saleReceiptData.creditBalanceAfter,
      items: saleReceiptData.items.map(item => ({
        productName: item.product.name,
        packagingName: getCartItemPricing(item).packaging?.name ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: getCartItemTotal(item),
      })),
      copyLabel: options?.copyLabel,
      footerMessage: 'Cupom emitido pelo PDV HappyCash.',
    }, {
      preferSilentPrint: options?.preferSilentPrint,
      automaticPrint: options?.automaticPrint,
      targetWindow: options?.targetWindow,
    });
  };

  const printLastSaleCoupon = async () => {
    if (!lastSaleData) return;
    const printed = await printSaleCouponFromData(lastSaleData, { copyLabel: '2ª via' });

    if (!printed) {
      silentToast.error('Nao foi possivel abrir a impressao do cupom.');
    }
  };

  const printSaleCouponCopy = (sale: Sale) => {
    const client = sale.client_id
      ? activeClients.find(item => item.id === sale.client_id)
      : null;
    const items = saleItems.filter(item => item.sale_id === sale.id);
    const subtotalValue = items.reduce((sum, item) => sum + item.total, 0);

    openRetailCouponPrintWindow({
      storeName: retailCouponStoreName,
      storeTaxId: receiptProfile.taxId,
      storeAddress: receiptProfile.address,
      storePhone: receiptProfile.phone,
      saleId: sale.id,
      saleDate: sale.date,
      operatorName: sale.seller_name || sellerName || null,
      customerName: client?.name || null,
      paymentMethod: formatPaymentMethod(sale.payment_method),
      total: sale.total,
      subtotal: subtotalValue,
      discount: sale.discount,
      changeAmount: sale.change_amount,
      cashReceived: sale.cash_received,
      isDelivery: sale.is_delivery,
      serviceTicketNumber: sale.service_ticket_number,
      items: items.map(item => ({
        productName: item.product_name,
        packagingName: item.packaging_name ?? null,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        total: item.total,
      })),
      copyLabel: '2ª via',
      footerMessage: 'Reimpressao do cupom da venda.',
    });
  };

  const retryFiscalIssuance = () => {
    if (!lastSaleData?.saleId || issuingFiscalDocument) return;
    void issueFiscalDocumentInHomologation(lastSaleData.saleId);
  };
  const handleOpenCash = async () => {
    if (!canOpenCash) {
      silentToast.error('Seu usuario nao tem permissao para abrir o caixa');
      return;
    }

    if (!user || !ownerUserId) {
      silentToast.error('Faça login novamente para abrir o caixa');
      return;
    }

    const amount = parseDecimalInput(openingAmount);
    if (amount < 0) { silentToast.error('Valor de abertura inválido'); return; }

    setIsVerifyingOpenCashAdmin(true);
    setOpenCashAuthError('');
    try {
      const authorization = await verifyAdminAuthorization({
        login: openCashAdminLogin,
        secret: openCashAdminSecret,
        setError: setOpenCashAuthError,
      });

      if (!authorization.ok) return;
    } catch (error) {
      console.error('Erro ao validar administrador para abertura do caixa:', getRedactedLogValue(error));
      setOpenCashAuthError('Nao foi possivel validar o administrador.');
      return;
    } finally {
      setIsVerifyingOpenCashAdmin(false);
    }

    if (canUseDesktopOffline && typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineSessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `cash-${Date.now()}`;
      const openedAt = new Date().toISOString();
      const queued = await enqueueOfflineOperation(ownerUserId, 'cash_session.open', {
        session: {
          id: offlineSessionId,
          owner_user_id: ownerUserId,
          operator_user_id: user.id,
          operator_name: sellerName,
          opened_by_name: sellerName,
          opening_amount: amount,
          opened_at: openedAt,
          status: 'open',
          ...(operationalLocationId ? {
            location_id: operationalLocationId,
            terminal_id: operationalTerminalId,
          } : {}),
        },
      });

      if (!queued) {
        silentToast.error('Não foi possível abrir o caixa offline');
        return;
      }

      const session: CashSession = {
        id: offlineSessionId,
        openedAt,
        openingAmount: amount,
        openedBy: sellerName,
        ownerUserId,
        operatorUserId: user.id,
        locationId: operationalLocationId,
        terminalId: operationalTerminalId,
      };

      writeScopedCashSession(ownerUserId, user.id, session);
      setCashSession(session);
      setOpeningAmount('');
      setOpenCashAdminLogin('');
      setOpenCashAdminSecret('');
      setSaleSearch('');
      setSaleLimit(25);
      silentToast.success('Caixa aberto em modo offline!');
      return;
    }

    const { data, error } = await db
      .from('cash_sessions')
      .insert({
        owner_user_id: ownerUserId,
        operator_user_id: user.id,
        operator_name: sellerName,
        opened_by_name: sellerName,
        opening_amount: amount,
        ...(operationalLocationId ? {
          location_id: operationalLocationId,
          terminal_id: operationalTerminalId,
        } : {}),
      })
      .select(operationalLocationId
        ? 'id, opened_at, opening_amount, opened_by_name, location_id, terminal_id'
        : 'id, opened_at, opening_amount, opened_by_name')
      .single();

    if (error || !data) {
      console.error('Erro ao abrir caixa:', getRedactedLogValue(error));
      silentToast.error('Não foi possível abrir o caixa');
      return;
    }

    const session: CashSession = {
      id: data.id,
      openedAt: data.opened_at,
      openingAmount: Number(data.opening_amount || 0),
      openedBy: data.opened_by_name,
      ownerUserId,
      operatorUserId: user.id,
      locationId: data.location_id ?? operationalLocationId,
      terminalId: data.terminal_id ?? operationalTerminalId,
    };

    writeScopedCashSession(ownerUserId, user.id, session);
    setCashSession(session);
    setOpeningAmount('');
    setOpenCashAdminLogin('');
    setOpenCashAdminSecret('');
    setSaleSearch('');
    setSaleLimit(25);
    silentToast.success('Caixa aberto!');
  };

  const handleCloseCash = async (cashClient: typeof db = db) => {
    if (!canCloseCash) {
      silentToast.error('Seu usuario nao tem permissao para fechar o caixa');
      return;
    }
    if (!cashSession) return;
    if (countedClosingValue === null || countedClosingValue < 0) {
      silentToast.error('Informe o valor contado no caixa.');
      return;
    }
    if (Math.abs(closingDifference) >= 0.01 && !closingDifferenceReason.trim()) {
      silentToast.error('Justifique a diferença do fechamento.');
      return;
    }

    const receipt: CashCloseReceipt = {
      openedAt: cashSession.openedAt,
      closedAt: new Date().toISOString(),
      openedBy: cashSession.openedBy,
      closedBy: sellerName,
      openingAmount: cashOpeningAmount,
      salesTotal: cashSalesTotal,
      cashOutTotal,
      finalBalance: countedClosingValue,
      expectedBalance: currentCashBalance,
      countedBalance: countedClosingValue,
      difference: closingDifference,
      differenceReason: closingDifferenceReason.trim(),
      saleCount: cashSessionSales.length,
      cashOuts: cashSessionCashOuts,
      sales: cashSessionSales,
    };

    if (cashSession.id && canUseDesktopOffline && typeof navigator !== 'undefined' && navigator.onLine === false) {
      const queued = await enqueueOfflineOperation(ownerUserId!, 'cash_session.close', {
        sessionId: cashSession.id,
        closedAt: receipt.closedAt,
        closedByUserId: user?.id ?? null,
        closedByName: sellerName,
        closingBalance: countedClosingValue,
        expectedBalance: currentCashBalance,
        countedBalance: countedClosingValue,
        differenceReason: closingDifferenceReason.trim() || null,
      });

      if (!queued) {
        silentToast.error('Não foi possível fechar o caixa offline');
        return;
      }
    } else if (cashSession.id) {
      const { error } = await cashClient.rpc('erp_close_cash_session_atomic', {
        p_session_id: cashSession.id,
        p_expected: currentCashBalance,
        p_counted: countedClosingValue,
        p_reason: closingDifferenceReason.trim() || null,
      });

      if (error) {
        console.error('Erro ao fechar caixa:', getRedactedLogValue(error));
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
    if (cashSession.ownerUserId && cashSession.operatorUserId) {
      writeScopedCashSession(cashSession.ownerUserId, cashSession.operatorUserId, null);
    }
    setCashSession(null);
    setCashSessionLoading(false);
    setShowSalesSearch(false);
    setShowCashOut(false);
    setSaleSearch('');
    setSaleLimit(25);
    setShowCloseCashReceipt(true);
    setCountedClosingBalance('');
    setClosingDifferenceReason('');
    silentToast.success(
      canUseDesktopOffline && typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'Caixa fechado em modo offline!'
        : 'Caixa fechado!',
    );
  };

  const sendCloseCashReportEmail = async (receipt: CashCloseReceipt) => {
    setCloseCashLastSentChannel('email');

    if (isInternetUnavailable()) {
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage('Conecte-se à internet para enviar o relatório por e-mail. O fechamento offline continua salvo no sistema.');
      setCloseCashEmailRecipients([]);
      return;
    }

    if (!user || !session?.access_token) {
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage('Faça login novamente para enviar o relatório por e-mail.');
      setCloseCashEmailRecipients([]);
      return;
    }

    const recipients = parseEmailRecipients(closeCashEmailRecipientInput);
    const invalidRecipients = recipients.filter(recipient => !isValidEmailRecipient(recipient));

    if (invalidRecipients.length > 0) {
      setCloseCashLastSentChannel('email');
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage(`E-mail inválido: ${invalidRecipients.join(', ')}`);
      setCloseCashEmailRecipients([]);
      return;
    }

    setShowCloseCashSendDialog(false);
    setCloseCashEmailStatus('sending');
    setCloseCashEmailMessage('Enviando relatório por e-mail...');
    setCloseCashEmailRecipients([]);

    try {
      const { data, error } = await supabase.functions.invoke<CashCloseEmailResponse>('send-cash-close-report', {
        body: {
          receipt,
          recipients,
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
      try {
        window.localStorage.setItem(CLOSE_CASH_EMAIL_RECIPIENTS_KEY, recipients.join(', '));
      } catch {
        // Ignore localStorage persistence failures for email recipients.
      }
    } catch (error) {
      console.error('Erro ao enviar relatório de fechamento por e-mail:', getRedactedLogValue(error));
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage(await getCloseCashEmailErrorMessage(error));
      setCloseCashEmailRecipients([]);
    }
  };

  const sendCloseCashReportWhatsApp = (receipt: CashCloseReceipt) => {
    const normalizedPhone = normalizePhone(closeCashWhatsappPhone);
    setCloseCashLastSentChannel('whatsapp');

    if (isInternetUnavailable()) {
      setCloseCashEmailStatus('error');
      setCloseCashEmailMessage(INTERNET_REQUIRED_MESSAGE);
      setCloseCashEmailRecipients([]);
      return;
    }

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
      window.sessionStorage.setItem(CLOSE_CASH_WHATSAPP_PHONE_KEY, normalizedPhone);
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
    setCloseCashSendChannel('email');
    setShowCloseCashSendDialog(true);
  };

  const requestCloseCash = () => {
    if (!canCloseCash) {
      silentToast.error('Seu usuario nao tem permissao para fechar o caixa');
      return;
    }
    if (!cashSession) return;
    if (cart.length > 0) {
      silentToast.error('Finalize ou zere o carrinho antes de fechar o caixa');
      return;
    }

    setCountedClosingBalance(currentCashBalance.toFixed(2));
    setClosingDifferenceReason('');

    setAdminEmail('');
    setAdminPassword('');
    setCloseCashAuthError('');
    setShowCloseCashAuth(true);
  };

  const verifyAdminAuthorization = async ({
    login,
    secret,
    setError,
  }: {
    login: string;
    secret: string;
    setError: (message: string) => void;
  }) => {
    const normalizedLogin = login.trim().toLowerCase();
    const normalizedSecret = secret.trim();

    if (!normalizedLogin) {
      setError('Digite o email ou usuario do administrador.');
      return { ok: false as const, adminDb: null };
    }

    if (!normalizedSecret) {
      setError('Digite a senha ou PIN do administrador.');
      return { ok: false as const, adminDb: null };
    }

    if (!ownerUserId) {
      setError('Nao foi possivel identificar a loja.');
      return { ok: false as const, adminDb: null };
    }

    if (!normalizedLogin.includes('@')) {
      const verification = await verifyOfflineAdminAccess({
        ownerUserId,
        username: normalizedLogin,
        pin: normalizedSecret,
      });

      if (!verification.success) {
        setError(verification.error);
        return { ok: false as const, adminDb: null };
      }

      return { ok: true as const, adminDb: db };
    }

    if (!session?.access_token) {
      setError('Sua sessão expirou. Entre novamente para validar o administrador.');
      return { ok: false as const, adminDb: null };
    }

    const { data: verificationData, error: verificationError } = await supabase.functions.invoke<{ success?: boolean; error?: string }>('manage-operators', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        action: 'verify_admin',
        adminEmail: normalizedLogin,
        adminPassword: normalizedSecret,
      },
    });

    if (verificationError || !verificationData?.success) {
      setError(await getAdminVerificationErrorMessage(
        verificationError,
        'Email ou senha de administrador incorretos.',
        verificationData,
      ));
      return { ok: false as const, adminDb: null };
    }

    return { ok: true as const, adminDb: db };
  };

  const confirmCloseCashWithAdminPassword = async () => {
    setIsVerifyingAdminPassword(true);
    setCloseCashAuthError('');

    try {
      const authorization = await verifyAdminAuthorization({
        login: adminEmail,
        secret: adminPassword,
        setError: setCloseCashAuthError,
      });

      if (!authorization.ok) return;

      setShowCloseCashAuth(false);
      setAdminEmail('');
      setAdminPassword('');
      await handleCloseCash(authorization.adminDb ?? db);
    } catch (error) {
      console.error('Erro ao validar senha para fechamento do caixa:', getRedactedLogValue(error));
      setCloseCashAuthError('Não foi possível validar as credenciais do administrador.');
    } finally {
      setIsVerifyingAdminPassword(false);
    }
  };

  const handleCashOut = async () => {
    if (!canCashOut) {
      silentToast.error('Seu usuario nao tem permissao para realizar sangria');
      return;
    }
    if (!cashSession) { silentToast.error('Abra o caixa antes de registrar saída'); return; }
    const amount = cashOutAmountValue;
    if (!amount || amount <= 0) { silentToast.error('Valor inválido'); return; }
    if (!cashOutReason.trim()) { silentToast.error('Informe o motivo da saída'); return; }
    if (cashOutExceedsBalance) {
      silentToast.error(`Saída maior que o saldo disponível: ${formatMoney(currentCashBalance)}`);
      return;
    }

    try {
      await addExpense(cashOutReason.trim(), amount, 'Saída de caixa', {
        operatorUserId: user?.id ?? null,
        cashSessionId: cashSession.id ?? null,
      });
      setCashOutAmount('');
      setCashOutReason('');
      setShowCashOut(false);
      silentToast.success('Saída de caixa registrada!');
    } catch (error) {
      console.error('Erro ao registrar saída de caixa:', getRedactedLogValue(error));
      silentToast.error('Não foi possível registrar a saída de caixa');
    }
  };

  const handleCancelSale = async () => {
    if (!canCancelSale) {
      silentToast.error('Seu usuario nao tem permissao para cancelar vendas');
      return;
    }
    if (!saleToCancel) return;
    if (!cancelReason.trim()) { silentToast.error('Informe o motivo do cancelamento'); return; }

    try {
      await cancelSale(saleToCancel, cancelReason.trim());
      setSaleToCancel(null);
      setCancelReason('');
      silentToast.success('Venda cancelada!');
    } catch (error) {
      console.error('Erro ao cancelar venda:', getRedactedLogValue(error));
      const message = getPublicErrorMessage(error, 'Não foi possível cancelar a venda');
      silentToast.error(message);
    }
  };

  const requestCashOut = () => {
    if (!canCashOut) {
      silentToast.error('Seu usuario nao tem permissao para realizar sangria');
      return;
    }
    setShowCashOut(true);
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return element.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === 'Escape' && event.target === searchInputRef.current) {
        event.preventDefault();
        setSearch('');
        setSearchSelectedIndex(-1);
        searchInputRef.current?.blur();
        return;
      }

      if (cartItemPendingPriceEdit) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCartItemPriceEditor();
        }
        return;
      }

      if (showReceipt) return;
      if (pendingServiceTicketAdminAction) return;

      if (showCloseServiceTicketExitPrompt) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeServiceTicketExitPrompt();
          return;
        }

        return;
      }

      if (showScannerNotFoundDialog) {
        const isScannerLikePrintableKey = event.key.length === 1 && /^[0-9A-Z-]$/i.test(event.key);
        const now = Date.now();

        if (isScannerLikePrintableKey) {
          lastScannerNotFoundKeyAtRef.current = now;
          event.preventDefault();
          return;
        }

        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          closeScannerNotFoundDialog();
          return;
        }

        if (event.key === 'Tab') {
          if (now - lastScannerNotFoundKeyAtRef.current < 250) {
            lastScannerNotFoundKeyAtRef.current = 0;
          }
          event.preventDefault();
          return;
        }

        event.preventDefault();
        return;
      }

      const checkoutModalLockActive = showCheckout || showFinalizeConfirm || showCreditInstallmentsDialog;
      const scannerLikePrintableKey = event.key.length === 1 && /^[0-9A-Z-]$/i.test(event.key);
      if (checkoutModalLockActive && !isEditableTarget(event.target)) {
        const now = Date.now();

        if (scannerLikePrintableKey) {
          lastCheckoutModalScannerKeyAtRef.current = now;
          event.preventDefault();
          return;
        }

        if ((event.key === 'Enter' || event.key === 'Tab') && now - lastCheckoutModalScannerKeyAtRef.current < 250) {
          lastCheckoutModalScannerKeyAtRef.current = 0;
          event.preventDefault();
          return;
        }

        if (now - lastCheckoutModalScannerKeyAtRef.current >= 250) {
          lastCheckoutModalScannerKeyAtRef.current = 0;
        }
      }

      if (!isEditableTarget(event.target) && scannerLikePrintableKey) {
        event.preventDefault();
        registerScannerLikeKey(event.key.toUpperCase());
        return;
      }

      if (!isEditableTarget(event.target) && (event.key === 'Enter' || event.key === 'Tab') && isLikelyScannerSubmit()) {
        event.preventDefault();
        void addSearchResultToCart({
          silentIfNotFound: true,
          clearSearchOnNotFound: true,
          query: scannerBufferRef.current,
          focusAfterSuccess: false,
        });
        return;
      }

      if (cartKeyboardSelectionIndex !== null) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setCartKeyboardSelectionIndex(null);
          return;
        }

        if (event.key === 'Tab') {
          event.preventDefault();
          moveCartKeyboardSelection(event.shiftKey);
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          openSelectedCartItemPriceEditor();
          return;
        }
      }
      if (showCreditInstallmentsDialog) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeCreditInstallmentsDialog();
          return;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          confirmCreditInstallments();
          return;
        }

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
          suppressCartClearForCurrentEsc();
          lastEscToClearCartAtRef.current = Date.now();
          setShowFinalizeConfirm(false);
          setShowCheckout(false);
          return;
        }

        if (event.key === 'F3') {
          event.preventDefault();
          handlePaymentMethodChange('dinheiro');
          return;
        }

        if (event.key === 'F4') {
          event.preventDefault();
          handlePaymentMethodChange('pix');
          return;
        }

        if (event.key === 'F5') {
          event.preventDefault();
          handlePaymentMethodChange('cartao_debito');
          return;
        }

        if (event.key === 'F6') {
          event.preventDefault();
          handlePaymentMethodChange('cartao_credito');
          return;
        }

        if (event.key === 'F7') {
          event.preventDefault();
          handlePaymentMethodChange('fiado');
          return;
        }

        if (event.key === 'F9') {
          event.preventDefault();
          requestFinalizeConfirmation();
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

      if (!isMobile && event.key === 'F11') {
        event.preventDefault();
        toggleCashierMode();
        return;
      }

      if (event.key === 'F1') {
        event.preventDefault();
        navigate('/');
        return;
      }

      if (showSalesSearch || showCancelledSales || showCashOut || showCloseCashReceipt || showOpenCashDialog || saleToCancel) return;

      if (event.key === 'Tab' && !isEditableTarget(event.target) && filtered.length > 0) {
        event.preventDefault();
        moveSearchSelection(event.shiftKey);
        return;
      }

      if (event.key === 'Escape' && !showReceipt) {
        event.preventDefault();
        if (ignoreCartClearOnEscRef.current) {
          return;
        }
        if (cart.length === 0 && !activeServiceTicketId) {
          lastEscToClearCartAtRef.current = 0;
          return;
        }

        const now = Date.now();
        const shouldClearCart = now - lastEscToClearCartAtRef.current <= 900;
        if (shouldClearCart) {
          lastEscToClearCartAtRef.current = 0;
          if (activeServiceTicketId) {
            setShowCloseServiceTicketExitPrompt(true);
            return;
          }

          clearCart();
          return;
        }

        lastEscToClearCartAtRef.current = now;
        return;
      }

      if (event.code === 'Space' && !isEditableTarget(event.target)) {
        event.preventDefault();
        focusProductSearch();
        return;
      }

      if (event.key === 'F2') {
        event.preventDefault();
        openCheckout();
        return;
      }

      if (event.key === 'F3') {
        event.preventDefault();
        openCheckoutWithPayment('dinheiro');
        return;
      }

      if (event.key === 'F4') {
        event.preventDefault();
        openCheckoutWithPayment('pix');
        return;
      }

      if (event.key === 'F5') {
        event.preventDefault();
        openCheckoutWithPayment('cartao_debito');
        return;
      }

      if (event.key === 'F6') {
        event.preventDefault();
        openCheckoutWithPayment('cartao_credito');
        return;
      }

      if (event.key === 'F7') {
        event.preventDefault();
        openCheckoutWithPayment('fiado');
        return;
      }

      if (event.key === 'F8') {
        event.preventDefault();
        startCartPriceSelection();
        return;
      }

      if (event.key === 'F9') {
        event.preventDefault();
        requestFinalizeConfirmation();
        return;
      }

      if (event.key === 'F10') {
        event.preventDefault();
        requestCloseCash();
        return;
      }

      if (event.key === 'F12') {
        event.preventDefault();
        setShowSalesSearch(true);
        return;
      }

      if (!cashierMode && !isEditableTarget(event.target)) {
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
          requestCashOut();
          return;
        }

        if (event.key === '4') {
          event.preventDefault();
          openCheckout();
          return;
        }

        if (event.key === '5') {
          event.preventDefault();
          requestCloseCash();
          return;
        }

        if (event.key === '0') {
          event.preventDefault();
          navigate('/');
          return;
        }

        if (event.key === '6') {
          event.preventDefault();
          requestCashOut();
          return;
        }

        if (event.key === '7') {
          event.preventDefault();
          requestCloseCash();
          return;
        }

        if (event.key === '8') {
          event.preventDefault();
          startCartPriceSelection();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // The keyboard handler intentionally tracks the current PDV render state.
    // Memoizing every command here makes this already-large component harder to audit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProducts, filtered, search, cart, cartKeyboardSelectionIndex, cartItemPendingPriceEdit, discount, paymentMethod, cashReceived, selectedClientId, total, change, canFinalizeCheckout, cashierMode, showCheckout, showFinalizeConfirm, showCreditInstallmentsDialog, showReceipt, showSalesSearch, showCancelledSales, showCashOut, showCloseCashReceipt, showOpenCashDialog, saleToCancel, navigate, isAdmin, creditInstallments, pendingCreditInstallments, showScannerNotFoundDialog, addSearchResultToCart, focusProductSearch, isLikelyScannerSubmit, pendingServiceTicketAdminAction, registerScannerLikeKey, isMobile]);

  if (loading) {
    return <DataRouteLoader label="Carregando PDV..." />;
  }

  return (
    <div
      className={`flex min-h-0 flex-col gap-3 overflow-hidden sm:gap-4 lg:flex-row ${
        cashierMode ? 'fixed inset-0 z-50 h-[100svh] bg-background p-3 sm:p-4' : 'h-full max-h-[100svh]'
      }`}
      data-tour-id="pdv-root"
    >
      <div className="shrink-0 lg:hidden">
        <Card className="border-border/50">
          <CardContent className="space-y-3 p-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mobilePanel === 'products' ? 'default' : 'outline'}
                className="h-10"
                onClick={() => {
                  setMobilePanel('products');
                  focusProductSearch();
                }}
              >
                Produtos
              </Button>
              <Button
                type="button"
                variant={mobilePanel === 'cart' ? 'default' : 'outline'}
                className="h-10"
                onClick={() => setMobilePanel('cart')}
              >
                Carrinho ({cart.length})
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/80 px-3 py-2 text-sm">
              <div>
                <p className="font-medium">Resumo do carrinho</p>
                <p className="text-xs text-muted-foreground">
                  {cartUnits} unidade{cartUnits === 1 ? '' : 's'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold text-primary">{formatMoney(subtotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products panel */}
      <div className={`${mobilePanel === 'products' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex`}>
        <div className="mb-3 shrink-0 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div data-tour-id="pdv-header">
            <h1 className="text-2xl font-bold">Caixa</h1>
            <p className="text-sm text-muted-foreground">
              Operador do caixa: <span className="font-medium text-foreground">{sellerName}</span> • {roleName}
            </p>
            {operationalScope && (
              <p className="text-xs text-muted-foreground">
                Filial: <span className="font-medium text-foreground">{operationalScope.location.name}</span>
                {' • '}Terminal: <span className="font-medium text-foreground">{operationalScope.terminal?.name ?? 'padrao'}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-end" data-tour-id="pdv-actions">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigate('/')}>
              Menu
              <span className="hidden md:inline"> (F1)</span>
            </Button>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowSalesSearch(true)}>
              <History className="mr-1 h-4 w-4" />
              Buscar vendas
              <span className="hidden md:inline"> (F12)</span>
            </Button>
            {canCashOut && (
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={requestCashOut}>
                <Wallet className="mr-1 h-4 w-4" />
                Saída de caixa
              </Button>
            )}
            <Button variant={cashierMode ? 'default' : 'outline'} size="sm" className="hidden md:inline-flex" onClick={toggleCashierMode}>
              {cashierMode ? <Minimize2 className="mr-1 h-4 w-4" /> : <Maximize2 className="mr-1 h-4 w-4" />}
              {cashierMode ? 'Sair tela cheia' : 'Tela cheia'} (F11)
            </Button>
            <span className="inline-flex w-full items-center justify-center rounded border border-border px-2.5 py-2 text-sm font-semibold sm:w-auto sm:justify-start">
              Caixa: {cashSession ? formatMoney(currentCashBalance) : 'fechado'}
            </span>
            {canCloseCash && (
              <Button variant="destructive" size="sm" className="w-full sm:w-auto" onClick={requestCloseCash} disabled={!cashSession}>
                Fechar caixa
                <span className="hidden md:inline"> (F10)</span>
              </Button>
            )}
          </div>
        </div>
        <div className="mb-3 shrink-0" data-tour-id="pdv-ticket-lookup">
          <div className="relative" data-tour-id="pdv-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              className="h-11 pl-11 text-base"
              disabled={showCheckout || showFinalizeConfirm || showCreditInstallmentsDialog || showScannerNotFoundDialog}
              placeholder="Escaneie produto, nome, numero da comanda ou comanda HC."
              value={search}
              onChange={e => {
                const nextValue = toProductUppercase(e.target.value);
                setSearch(nextValue);
                setSearchSelectedIndex(-1);

                if (!nextValue) {
                  resetScannerTracking();
                }
              }}
              onKeyDown={e => {
                if (e.key.length === 1 && /^[0-9A-Z-]$/i.test(e.key)) {
                  registerScannerLikeKey(e.key.toUpperCase());
                }

                if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Escape') {
                  resetScannerTracking();
                }

                if (e.key === 'Tab' && filtered.length > 0) {
                  e.preventDefault();
                  e.stopPropagation();
                  moveSearchSelection(e.shiftKey);
                  return;
                }

                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  void addSearchResultToCart(
                    isLikelyScannerSubmit()
                      ? { silentIfNotFound: true, clearSearchOnNotFound: true }
                      : undefined
                  );
                }
              }}
            />
          </div>
          {activeServiceTicket && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">Comanda {activeServiceTicket.number}</Badge>
              <span className="text-muted-foreground">
                {activeServiceTicketItems.length} item{activeServiceTicketItems.length === 1 ? '' : 's'} lancado{activeServiceTicketItems.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
        <div
          ref={productsGridRef}
          className={
            showIdleProductsState
              ? 'relative min-h-0 flex-1 overflow-hidden pb-28 pr-1 lg:pb-2'
              : 'grid min-h-0 flex-1 touch-pan-y auto-rows-min grid-cols-2 gap-2 overflow-y-auto overscroll-contain pb-28 pr-1 sm:grid-cols-3 lg:pb-2'
          }
          data-tour-id="pdv-products"
        >
          {showIdleProductsState ? (
            <div className="relative flex h-full min-h-[22rem] items-center justify-center overflow-hidden rounded-[28px] border border-border/60 bg-card/60 px-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="pointer-events-none absolute inset-px rounded-[27px] border border-white/[0.03]" />
              <div className="relative z-10 space-y-4">
                <p className="text-4xl font-black tracking-[0.22em] text-red-500 sm:text-5xl">
                  CAIXA LIVRE!
                </p>
                <p className="mx-auto max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                  Escaneie um produto ou digite a comanda pelo numero ou codigo HC para carregar os itens e finalizar a venda.
                </p>
              </div>
            </div>
          ) : showActiveEmptyTicketState && activeServiceTicket ? (
            <div className="relative flex h-full min-h-[22rem] items-center justify-center overflow-hidden rounded-[28px] border border-border/60 bg-card/60 px-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="pointer-events-none absolute inset-px rounded-[27px] border border-white/[0.03]" />
              <div className="relative z-10 space-y-4">
                <p className="text-3xl font-black tracking-[0.16em] text-foreground sm:text-4xl">
                  COMANDA {activeServiceTicket.number}
                </p>
                <p className="mx-auto max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                  Comanda aberta. Escaneie um produto para lancar itens nela.
                </p>
              </div>
            </div>
          ) : showProductResultsState ? (
            filtered.map((p, index) => (
              <motion.div
                key={p.id}
                ref={element => {
                  productSelectionRefs.current[index] = element;
                }}
                role="button"
                aria-label={`Selecionar produto ${p.name}`}
                tabIndex={index === searchSelectedIndex ? 0 : -1}
                whileTap={{ scale: 0.95 }}
                onKeyDown={event => {
                  if (event.key === 'Tab') {
                    event.preventDefault();
                    event.stopPropagation();
                    moveSearchSelection(event.shiftKey);
                    return;
                  }

                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleProductSelection(p);
                  }
                }}
              >
                <Card
                  className={`cursor-pointer transition-colors ${
                    index === searchSelectedIndex
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-border/50 hover:border-primary/50'
                  }`}
                  onClick={event => void handleProductPointerSelection(event, p)}
                >
                  <CardContent className="space-y-2 p-4">
                    <p className="min-h-[2.5rem] text-sm font-medium leading-tight whitespace-normal break-words">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatProductCode(p.code) || p.barcode || 'Sem código'}</p>
                    {(() => {
                      const packaging = productPackagings.find((item) => item.product_id === p.id && packagingMatchesSearch(item, search));
                      return packaging ? (
                        <div><Badge variant="secondary">{packaging.name} · {packaging.base_quantity} un</Badge><p className="mt-1 text-base font-bold text-primary">R$ {packaging.sale_price.toFixed(2)}</p></div>
                      ) : <p className="text-primary font-bold text-base">R$ {p.price.toFixed(2)}</p>;
                    })()}
                    {p.control_stock !== false && p.stock <= (p.min_stock || 5) && (
                      <p className="text-xs text-destructive">⚠️ Estoque: {p.stock}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : showProductNotFoundState ? (
            <div className="flex h-full min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 text-center">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Produto nao encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Confira o codigo de barras, o nome do produto ou a comanda.
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-[18rem]" />
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className={`${mobilePanel === 'cart' ? 'flex' : 'hidden'} min-h-0 w-full flex-1 flex-col overflow-hidden lg:flex lg:w-[26rem] lg:flex-none xl:w-[30rem]`}>
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/50" data-tour-id="pdv-cart">
          <CardHeader className="shrink-0 pb-2 px-4 pt-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-5 w-5" />
              Carrinho ({cart.length})
              {activeServiceTicket && <Badge variant="secondary">Comanda {activeServiceTicket.number}</Badge>}
              <span className="text-xs font-medium text-muted-foreground">Esc zera</span>
              <span className="text-xs font-medium text-destructive">F8 preço • Tab navega</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4 pt-0">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {cart.map((i, index) => {
                const pricing = getCartItemPricing(i);
                return (
                <div
                  key={getCartItemKey(i)}
                  ref={element => {
                    cartItemSelectionRefs.current[index] = element;
                  }}
                  tabIndex={cartKeyboardSelectionIndex === index ? 0 : -1}
                  className={`flex items-start gap-3 rounded-lg bg-secondary/50 p-3 outline-none transition-colors ${
                    cartKeyboardSelectionIndex === index
                      ? 'ring-2 ring-destructive/60 bg-destructive/5'
                      : ''
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-medium leading-tight whitespace-normal break-words">{i.product.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{i.quantity} unidade{i.quantity === 1 ? '' : 's'}</span>
                      {pricing.packaging && (
                        <Badge variant="secondary">
                          {pricing.packaging.name} · {pricing.packageCount} pacote{pricing.packageCount === 1 ? '' : 's'}
                          {pricing.remainderQuantity > 0 ? ` + ${pricing.remainderQuantity} un.` : ''}
                        </Badge>
                      )}
                      {!pricing.packaging && <span>x {formatMoney(i.unitPrice)}</span>}
                      {isCartItemPriceEdited(i) && <Badge variant="secondary">Preço alterado</Badge>}
                    </div>
                    {isCartItemPriceEdited(i) && (
                      <p className="text-xs text-muted-foreground">Preço base: {formatMoney(i.product.price)}</p>
                    )}
                    {canEditPdvPrice && !activeServiceTicket && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 justify-start border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => openCartItemPriceEditor(i)}
                      >
                        Alterar preço
                      </Button>
                    )}
                    <p className="text-sm font-semibold text-primary">{formatMoney(getCartItemTotal(i))}</p>
                  </div>
                  <div className="flex items-center gap-1 self-center">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void updateQty(i, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    {activeServiceTicket ? (
                      <span className="text-sm w-10 text-center font-medium">{i.quantity}</span>
                    ) : (
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={cartQuantityDrafts[getCartItemKey(i)] ?? String(i.quantity)}
                        onChange={(event) => {
                          const sanitized = event.target.value.replace(/[^\d]/g, '');
                          setCartQuantityDrafts((current) => ({
                            ...current,
                            [getCartItemKey(i)]: sanitized,
                          }));
                        }}
                        onBlur={(event) => commitCartQuantityInput(i, event.target.value)}
                        onFocus={(event) => event.target.select()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitCartQuantityInput(i, event.currentTarget.value);
                            event.currentTarget.blur();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setCartQuantityDraft(i, i.quantity);
                            event.currentTarget.blur();
                          }
                        }}
                        className="h-8 w-14 px-1 text-center text-sm font-medium"
                        aria-label={`Quantidade de ${i.product.name}`}
                      />
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void updateQty(i, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => requestRemoveFromCart(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                );
              })}
              {cart.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Carrinho vazio</p>}
            </div>

            <div className="shrink-0 rounded-lg border border-border bg-background/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Itens adicionados</span>
                <span>{cartUnits} unidade{cartUnits === 1 ? '' : 's'}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total dos itens adicionados</span>
                <span className="text-primary">{formatMoney(subtotal)}</span>
              </div>
            </div>

            <Button type="button" onClick={() => openCheckout()} className="h-11 w-full shrink-0 text-base" disabled={cart.length === 0 || isFinalizingSale} data-tour-id="pdv-checkout">
              <Receipt className="h-5 w-5 mr-2" />Finalizar Venda (F2)
            </Button>
            <Button type="button" variant="outline" className="h-10 w-full shrink-0 lg:hidden" onClick={() => setMobilePanel('products')}>
              Voltar para produtos
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

      <Dialog open={!!pendingServiceTicketAdminAction} onOpenChange={open => { if (!open) closePendingServiceTicketAdminAction(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingServiceTicketAdminAction?.type === 'remove' ? 'Remover item da comanda' : 'Diminuir quantidade da comanda'}
            </DialogTitle>
            <DialogDescription>
              Informe email e senha do administrador ou usuario e PIN offline para confirmar este ajuste.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{pendingServiceTicketAdminAction?.cartItem.product.name}</p>
              <p className="text-muted-foreground">
                {pendingServiceTicketAdminAction?.type === 'remove'
                  ? 'Todos os lancamentos desse item serao removidos da comanda.'
                  : 'A quantidade sera reduzida em 1 unidade.'}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Email ou usuario do administrador</Label>
              <Input
                autoFocus
                name="pdv-ticket-admin-login"
                value={serviceTicketAdminLogin}
                onChange={e => setServiceTicketAdminLogin(e.target.value)}
                placeholder="admin@empresa.com ou usuario admin"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label>Senha ou PIN</Label>
              <PasswordInput
                name="pdv-ticket-admin-secret"
                value={serviceTicketAdminSecret}
                onChange={e => setServiceTicketAdminSecret(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void confirmServiceTicketAdminAction();
                  }
                }}
                placeholder="Digite a senha ou PIN"
                autoComplete="new-password"
              />
            </div>
            {serviceTicketAdminAuthError && (
              <p className="text-sm font-medium text-destructive">{serviceTicketAdminAuthError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closePendingServiceTicketAdminAction}>Cancelar</Button>
            <Button type="button" onClick={() => void confirmServiceTicketAdminAction()} disabled={isVerifyingServiceTicketAdmin}>
              {isVerifyingServiceTicketAdmin ? 'Validando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cartItemPendingPriceEdit} onOpenChange={open => { if (!open) closeCartItemPriceEditor(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar preço do item</DialogTitle>
            <DialogDescription>
              {cartItemPendingPriceEdit
                ? `Defina o valor de venda para ${cartItemPendingPriceEdit.product.name}.`
                : 'Defina o novo valor do item.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{cartItemPendingPriceEdit?.product.name}</p>
              <p className="text-muted-foreground">
                Preço original: {cartItemPendingPriceEdit ? formatMoney(cartItemPendingPriceEdit.product.price) : 'R$ 0,00'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cart-item-price">Novo preço</Label>
              <Input
                id="cart-item-price"
                type="text"
                inputMode="decimal"
                value={pendingCartItemPrice}
                onFocus={e => e.currentTarget.select()}
                onChange={e => setPendingCartItemPrice(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCartItemPriceChange();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCartItemPriceEditor}>Cancelar</Button>
            <Button type="button" onClick={applyCartItemPriceChange}>Salvar preço</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout dialog */}
      <Dialog open={showCheckout} onOpenChange={open => { if (!isFinalizingSale) setShowCheckout(open); }}>
        <DialogContent
          ref={checkoutDialogRef}
          tabIndex={-1}
          className="max-h-[92svh] w-[calc(100vw-1rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-border bg-background p-4 shadow-2xl sm:max-h-[90vh] sm:w-full sm:p-6 lg:grid-rows-none lg:shadow-lg"
          onOpenAutoFocus={event => event.preventDefault()}
          onEscapeKeyDown={event => {
            event.preventDefault();
            suppressCartClearForCurrentEsc();
            lastEscToClearCartAtRef.current = Date.now();
            setShowFinalizeConfirm(false);
            setShowCheckout(false);
          }}
        >
          <DialogHeader className="space-y-1 pb-1 pr-8">
            <DialogTitle>Finalizar venda</DialogTitle>
          </DialogHeader>
          <div className="grid min-h-0 gap-4 overflow-y-auto pr-1 lg:grid-cols-[1.15fr_0.85fr] lg:overflow-hidden lg:pr-0">
            <div className="min-h-0 space-y-3">
              <div className="rounded-lg border border-border bg-background p-3 lg:bg-transparent">
                <p className="mb-2 text-sm font-semibold">Itens do carrinho</p>
                <div className="max-h-[22svh] space-y-1.5 overflow-y-auto pr-1 sm:max-h-[36vh]">
                  {cart.map(i => (
                    <div key={getCartItemKey(i)} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="block whitespace-normal break-words">{i.product.name}</span>
                        <span className="text-xs text-muted-foreground">{i.quantity} x {formatMoney(i.unitPrice)}</span>
                      </div>
                      <span className="font-medium whitespace-nowrap">{formatMoney(getCartItemTotal(i))}</span>
                    </div>
                  ))}
                  {cart.length === 0 && <p className="text-sm text-muted-foreground">Carrinho vazio</p>}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-3 space-y-1 lg:bg-transparent">
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {manualDiscount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto manual</span>
                    <span>-R$ {appliedManualDiscount.toFixed(2)}</span>
                  </div>
                )}
                {rewardDiscount > 0 && (
                  <div className="flex justify-between gap-3 text-sm text-destructive">
                    <span className="min-w-0 truncate">Recompensa{selectedReward ? `: ${selectedReward.name}` : ''}</span>
                    <span className="whitespace-nowrap">-R$ {appliedRewardDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-primary">R$ {total.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-background p-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
              <div className="grid grid-cols-[1fr_88px] items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-sm">Desconto</Label>
                  <Input type="text" inputMode="decimal" placeholder="0,00" value={discountInput} onChange={e => setDiscountInput(e.target.value)} className="h-9 text-sm" />
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
                  <Button type="button" variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('dinheiro')}>[1/F3] Dinheiro</Button>
                  <Button type="button" variant={paymentMethod === 'pix' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('pix')}>[2/F4] Pix</Button>
                  <Button type="button" variant={paymentMethod === 'fiado' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('fiado')}>[3/F7] Fiado</Button>
                  <Button type="button" variant={paymentMethod === 'cartao_debito' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('cartao_debito')}>[4/F5] Débito</Button>
                  <Button type="button" className="col-span-2" variant={paymentMethod === 'cartao_credito' ? 'default' : 'outline'} onClick={() => handlePaymentMethodChange('cartao_credito')}>[5/F6] Crédito</Button>
                </div>
              </div>

              {paymentMethod === 'cartao_credito' && (
                <div className="space-y-2 rounded-lg border border-border bg-card p-3 lg:bg-transparent">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Parcelamento</p>
                      <p className="text-xs text-muted-foreground">
                        {creditInstallments ? `${creditInstallments}x sem juros` : 'Escolha a quantidade de parcelas'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPendingCreditInstallments(creditInstallments ?? 1);
                        setShowCreditInstallmentsDialog(true);
                      }}
                    >
                      Escolher parcelas
                    </Button>
                  </div>
                </div>
              )}

              {paymentMethod === 'dinheiro' && (
                <div className="space-y-1">
                  <Label className="text-sm">Valor recebido</Label>
                  <Input
                    ref={cashReceivedInputRef}
                    type="text"
                    inputMode="decimal"
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

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Cliente {paymentMethod === 'fiado' ? '(obrigatório)' : '(opcional)'}</Label>
                  {selectedClientId && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedClientId('')}>
                      Limpar
                    </Button>
                  )}
                </div>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {activeClients.map(c => {
                      const creditLimit = getClientCreditLimit(c);
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{creditLimit !== null ? ` | limite ${formatMoney(creditLimit)}` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {shouldAskFiscalCustomerDocument && (
                <div className="space-y-1">
                  <Label className="text-sm">CPF/CNPJ na nota (opcional)</Label>
                  <Input
                    inputMode="numeric"
                    value={fiscalCustomerDocument}
                    onChange={event => setFiscalCustomerDocument(formatCpfCnpj(event.target.value))}
                    placeholder="Nota Fiscal Paulista"
                    className="h-9 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe apenas se o consumidor solicitar CPF/CNPJ no documento fiscal.
                  </p>
                </div>
              )}

              {paymentMethod === 'fiado' && selectedClient && selectedClientCreditLimit !== null && (
                <div className={`rounded-lg border p-3 text-xs ${fiadoExceedsCreditLimit ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'border-border bg-card text-muted-foreground lg:bg-transparent'}`}>
                  <p className="font-medium">Limite de crédito: {formatMoney(selectedClientCreditLimit)}</p>
                  <p>Saldo atual: {formatMoney(selectedClientBalance)} | Disponivel: {formatMoney(selectedClientAvailableCredit ?? 0)}</p>
                  {fiadoExceedsCreditLimit && <p className="mt-1 font-medium">Esta venda excede o limite do cliente.</p>}
                </div>
              )}

              {selectedClientId && (
                <div className="space-y-1 rounded-lg border border-border bg-card p-3 lg:bg-transparent">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Label className="text-sm">Recompensa</Label>
                      <p className="text-xs text-muted-foreground">
                        Consumo acumulado: {formatMoney(selectedClientSpending)}
                      </p>
                    </div>
                    {selectedRewardId && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedRewardId('')}>
                        Remover
                      </Button>
                    )}
                  </div>
                  {pdvEligibleRewards.length > 0 ? (
                    <Select value={selectedRewardId} onValueChange={setSelectedRewardId}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Escolha uma recompensa..." /></SelectTrigger>
                      <SelectContent>
                        {pdvEligibleRewards.map(reward => (
                          <SelectItem key={reward.id} value={reward.id}>{getPdvRewardLabel(reward)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma recompensa liberada para este cliente no PDV.
                    </p>
                  )}
                </div>
              )}

              <p className="pb-1 text-xs text-muted-foreground">Enter ou F9 pede confirmação para finalizar.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border bg-background pt-3 sm:pt-4 lg:bg-transparent">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowCheckout(false)} disabled={isFinalizingSale}>Voltar</Button>
            <Button type="button" className="w-full sm:w-auto" onClick={requestFinalizeConfirmation} disabled={cart.length === 0 || isFinalizingSale || !canFinalizeCheckout}>
              <Receipt className="h-4 w-4 mr-2" />Finalizar venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreditInstallmentsDialog}
        onOpenChange={open => {
          if (open) {
            setShowCreditInstallmentsDialog(true);
            return;
          }

          closeCreditInstallmentsDialog();
        }}
      >
        <DialogContent
          ref={creditInstallmentsDialogRef}
          tabIndex={-1}
          className="max-w-sm"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Parcelamento no crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione a quantidade de parcelas para finalizar no cartão de crédito.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {CREDIT_INSTALLMENT_OPTIONS.map(installments => (
                <Button
                  key={installments}
                  type="button"
                  variant={pendingCreditInstallments === installments ? 'default' : 'outline'}
                  onClick={() => setPendingCreditInstallments(installments)}
                >
                  {installments}x
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={closeCreditInstallmentsDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmCreditInstallments}>
              Confirmar parcelas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinalizeConfirm} onOpenChange={open => { if (!isFinalizingSale) setShowFinalizeConfirm(open); }}>
        <DialogContent
          ref={finalizeConfirmDialogRef}
          tabIndex={-1}
          className="max-w-sm"
          onOpenAutoFocus={event => event.preventDefault()}
          onEscapeKeyDown={event => {
            event.preventDefault();
            setShowFinalizeConfirm(false);
          }}
        >
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

      <Dialog open={showScannerNotFoundDialog} onOpenChange={() => undefined}>
        <DialogContent
          ref={scannerNotFoundDialogRef}
          tabIndex={-1}
          className="max-w-sm [&>button]:hidden"
          onOpenAutoFocus={event => event.preventDefault()}
          onEscapeKeyDown={event => {
            event.preventDefault();
            closeScannerNotFoundDialog();
          }}
          onPointerDownOutside={event => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Produto nao encontrado</DialogTitle>
            <DialogDescription>
              {scannerNotFoundMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={closeScannerNotFoundDialog}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCloseServiceTicketExitPrompt} onOpenChange={setShowCloseServiceTicketExitPrompt}>
        <AlertDialogContent
          onOpenAutoFocus={event => {
            event.preventDefault();
            closeServiceTicketExitCancelRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingServiceTicketToOpen ? 'Trocar de comanda?' : 'Sair da comanda?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingServiceTicketToOpen && activeServiceTicket
                ? `A comanda ${activeServiceTicket.number} saira da tela do PDV para abrir a comanda ${pendingServiceTicketToOpen.number}.`
                : 'A comanda continuara aberta com os itens ja lancados. Isso fecha apenas a visualizacao dela no PDV.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              ref={closeServiceTicketExitCancelRef}
              onClick={closeServiceTicketExitPrompt}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseServiceTicketView}>
              {pendingServiceTicketToOpen ? 'Trocar comanda' : 'Sair da comanda'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sales search dialog */}
      <Dialog open={showSalesSearch} onOpenChange={setShowSalesSearch}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader><DialogTitle>Buscar vendas</DialogTitle></DialogHeader>
          <div className="flex min-h-0 flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
              <Input
                value={saleSearch}
                onChange={e => setSaleSearch(e.target.value)}
                placeholder="Buscar por vendedor, cliente, data, total, forma ou troco..."
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
                const saleCashReceived = Number(sale.cash_received || 0);
                const saleChangeAmount = Number(sale.change_amount || 0);
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
                          <p className="text-sm text-muted-foreground">{formatPaymentMethod(sale.payment_method)}</p>
                          {sale.payment_method === 'dinheiro' && (
                            <p className="text-sm text-muted-foreground">
                              Recebido: {formatMoney(saleCashReceived)} | Troco: {formatMoney(saleChangeAmount)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          {!isCancelled && canCancelSale && (
                            <Button type="button" variant="outline" size="sm" onClick={() => printSaleCouponCopy(sale)}>
                              <Printer className="mr-1 h-4 w-4" />2ª via do cupom
                            </Button>
                          )}
                          {!isCancelled && (
                            <Button variant="destructive" size="sm" onClick={() => { setSaleToCancel(sale.id); setCancelReason(''); }}>
                              <Ban className="h-4 w-4 mr-1" />Cancelar
                            </Button>
                          )}
                        </div>
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
                type="text"
                inputMode="decimal"
                value={cashOutAmount}
                onChange={e => setCashOutAmount(e.target.value)}
                placeholder="0,00"
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
            setAdminEmail('');
            setAdminPassword('');
            setCloseCashAuthError('');
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Confirmar fechamento (administrador)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para fechar o caixa, informe email/senha ou usuario/PIN de um administrador da loja.
            </p>
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Calculado</p><p className="font-semibold">{formatMoney(currentCashBalance)}</p></div>
              <div><Label>Valor contado</Label><Input inputMode="decimal" value={countedClosingBalance} onChange={e => setCountedClosingBalance(e.target.value)} /></div>
            </div>
            <p className={`text-sm font-medium ${Math.abs(closingDifference) >= 0.01 ? 'text-destructive' : 'text-green-600'}`}>
              Diferença: {formatMoney(closingDifference)}
            </p>
            {Math.abs(closingDifference) >= 0.01 && (
              <div className="space-y-1"><Label>Justificativa da diferença</Label><Textarea value={closingDifferenceReason} onChange={e => setClosingDifferenceReason(e.target.value)} placeholder="Ex: troco informado incorretamente" /></div>
            )}
            <div className="rounded-md border border-border bg-secondary/20 p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Resumo do fechamento</p>
                <span className="text-xs text-muted-foreground">
                  {cashSessionSales.length} venda{cashSessionSales.length === 1 ? '' : 's'} registrada{cashSessionSales.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {currentCloseCashPaymentSummary.map(item => (
                  <div key={item.key} className="rounded-md border border-border bg-background p-2">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-semibold text-primary">{formatMoney(item.total)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-md border border-border bg-background p-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Saídas de caixa</p>
                  <p className="font-semibold text-destructive">{formatMoney(cashOutTotal)}</p>
                </div>
                {cashSessionCashOuts.length > 0 ? (
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {cashSessionCashOuts.slice(0, 4).map(expense => (
                      <div key={expense.id} className="flex items-start justify-between gap-3">
                        <span className="min-w-0 truncate">{expense.description}</span>
                        <span className="shrink-0 font-medium text-foreground">{formatMoney(expense.amount)}</span>
                      </div>
                    ))}
                    {cashSessionCashOuts.length > 4 && (
                      <p>+ {cashSessionCashOuts.length - 4} saída{cashSessionCashOuts.length - 4 === 1 ? '' : 's'} no detalhe do recibo.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Sem saídas registradas nesta abertura.</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Email ou usuario do administrador</Label>
              <Input
                autoFocus
                name="pdv-close-cash-admin-login"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="admin@empresa.com ou usuario admin"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label>Senha ou PIN</Label>
              <PasswordInput
                name="pdv-close-cash-admin-secret"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void confirmCloseCashWithAdminPassword();
                  }
                }}
                placeholder="Digite a senha ou PIN"
                autoComplete="new-password"
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
                setAdminEmail('');
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
      <Dialog modal={false} open={showOpenCashDialog} onOpenChange={() => undefined}>
        <DialogContent
          data-tour-id="pdv-open-cash"
          onEscapeKeyDown={event => event.preventDefault()}
          onPointerDownOutside={event => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Abrir caixa</DialogTitle>
            <DialogDescription>
              Informe o valor inicial e confirme com credenciais de administrador para liberar o PDV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Valor de abertura</Label>
              <Input
                autoFocus
                type="text"
                inputMode="decimal"
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
            <div className="space-y-1">
              <Label>Email ou usuario do administrador</Label>
              <Input
                name="pdv-open-cash-admin-login"
                value={openCashAdminLogin}
                onChange={e => setOpenCashAdminLogin(e.target.value)}
                placeholder="admin@empresa.com ou usuario admin"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label>Senha ou PIN do administrador</Label>
              <PasswordInput
                name="pdv-open-cash-admin-secret"
                value={openCashAdminSecret}
                onChange={e => setOpenCashAdminSecret(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleOpenCash();
                  }
                }}
                placeholder="Senha ou PIN"
                autoComplete="new-password"
              />
            </div>
            {openCashAuthError && (
              <p className="text-sm font-medium text-destructive">{openCashAuthError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate('/')}>Voltar ao menu</Button>
            <Button onClick={handleOpenCash} disabled={isVerifyingOpenCashAdmin || !canOpenCash}>
              {!canOpenCash ? 'Sem permissao para abrir' : isVerifyingOpenCashAdmin ? 'Validando...' : 'Abrir caixa'}
            </Button>
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
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">Formas de pagamento</p>
                  <p className="text-xs text-muted-foreground">
                    {lastCloseReceipt.saleCount} venda{lastCloseReceipt.saleCount === 1 ? '' : 's'} no fechamento
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {closeCashReceiptPaymentSummary.map(item => (
                    <div key={item.key} className="rounded-lg border border-border bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-bold text-primary">{formatMoney(item.total)}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.count} venda{item.count === 1 ? '' : 's'}
                      </p>
                    </div>
                  ))}
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
                <Label>Destinatários do e-mail</Label>
                <Textarea
                  value={closeCashEmailRecipientInput}
                  onChange={event => setCloseCashEmailRecipientInput(event.target.value)}
                  placeholder="Em branco usa o e-mail cadastrado no happycashsite"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para usar o e-mail da conta da loja. Separe vários e-mails por vírgula, ponto e vírgula ou linha.
                </p>
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
              disabled={false}
            >
              {closeCashSendChannel === 'email' ? 'Enviar por e-mail' : 'Abrir no WhatsApp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt dialog */}
      <Dialog
        open={showReceipt}
        onOpenChange={setShowReceipt}
      >
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Venda finalizada</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
            {lastSaleData && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Resumo da venda</p>
                </div>

                <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1 text-sm sm:max-h-[36vh]">
                  {lastSaleData.items.map((item, index) => (
                    <div key={index} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block whitespace-normal break-words">{item.product.name}</span>
                        <span className="text-xs text-muted-foreground">{item.quantity} x {formatMoney(item.unitPrice)}</span>
                      </div>
                      <span className="whitespace-nowrap">{formatMoney(getCartItemTotal(item))}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 border-t pt-3 text-sm">
                  {lastSaleData.discount > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Desconto</span>
                      <span>-R$ {lastSaleData.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>R$ {lastSaleData.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pagamento</span>
                    <span>{lastSaleData.method}</span>
                  </div>
                  {lastSaleData.change > 0 && (
                    <p className="font-medium text-primary">Troco: R$ {lastSaleData.change.toFixed(2)}</p>
                  )}
                </div>
              </div>
            )}

            {lastSaleData && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Cupom não fiscal</p>
                    <p className="text-xs text-muted-foreground">
                      Documento de venda rápida de varejo ao consumidor final.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => { void printLastSaleCoupon(); }}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir 2ª via
                  </Button>
                </div>
              </div>
            )}

            {isAdmin && canUseFiscalModule && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">
                        {fiscalRuntime?.provider === 'nuvem_fiscal' ? 'NFC-e via Nuvem Fiscal' : 'NFC-e em homologacao'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fiscalRuntime?.provider === 'nuvem_fiscal'
                          ? 'Emissao enviada para a API fiscal configurada em Notas.'
                          : 'Fluxo inicial salvo em Notas e executado no PDV.'}
                      </p>
                    </div>
                  </div>
                  {lastFiscalDocument ? (
                    <Badge variant={fiscalStatusVariant(lastFiscalDocument.status)}>
                      {fiscalStatusLabel(lastFiscalDocument.status)}
                    </Badge>
                  ) : issuingFiscalDocument ? (
                    <Badge variant="outline">Emitindo</Badge>
                  ) : (
                    <Badge variant={checkoutFiscalBadgeVariant}>{checkoutFiscalStatusLabel}</Badge>
                  )}
                </div>

                {issuingFiscalDocument && (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {fiscalRuntime?.provider === 'nuvem_fiscal'
                      ? 'Enviando a NFC-e desta venda para a Nuvem Fiscal...'
                      : 'Gerando o DANFE simplificado de homologacao desta venda...'}
                  </div>
                )}

                {!issuingFiscalDocument && lastFiscalDocument && (
                  <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="grid gap-2 sm:grid-cols-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Numero/Série:</span>{' '}
                        <span className="font-medium">{lastFiscalDocument.number}/{lastFiscalDocument.series}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Ambiente:</span>{' '}
                        <span className="font-medium">{lastFiscalDocument.environment}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Emissao:</span>{' '}
                        <span className="font-medium">{formatSaleDate(lastFiscalDocument.emittedAt)}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Venda:</span>{' '}
                        <span className="font-medium">{lastFiscalDocument.saleId}</span>
                      </p>
                    </div>

                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">Chave de acesso</p>
                      <p className="break-all font-mono text-xs">{lastFiscalDocument.accessKey}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => openFiscalDocumentPrintWindow(lastFiscalDocument)}>
                        <Printer className="mr-2 h-4 w-4" />
                        Abrir DANFE
                      </Button>
                    </div>
                  </div>
                )}

                {!issuingFiscalDocument && lastFiscalDocumentError && (
                  <div className="space-y-3">
                    <Alert variant="destructive">
                      <AlertTitle>Falha ao emitir a NFC-e</AlertTitle>
                      <AlertDescription>{lastFiscalDocumentError}</AlertDescription>
                    </Alert>

                    {lastSaleData && (
                      <Button type="button" variant="outline" onClick={retryFiscalIssuance}>
                        Tentar novamente
                      </Button>
                    )}
                  </div>
                )}

                {!issuingFiscalDocument && !lastFiscalDocument && !lastFiscalDocumentError && !canIssueFiscalDocumentInHomologation && (
                  <Alert>
                    <AlertTitle>NFC-e nao emitida para esta venda</AlertTitle>
                    <AlertDescription>
                      {fiscalRuntimeError
                        ? fiscalRuntimeError
                        : !fiscalRuntime?.enabled
                          ? 'A NFC-e esta desativada no painel Notas.'
                          : fiscalRuntime.providerConfigured === false
                            ? 'As credenciais da API fiscal ainda nao estao configuradas no servidor.'
                          : !fiscalRuntime?.ready
                            ? `A configuracao fiscal ainda esta incompleta${fiscalRuntime?.missingItems?.length ? `: ${fiscalRuntime.missingItems.join(', ')}.` : '.'}`
                            : 'O provedor fiscal atual nao esta pronto para emitir esta venda.'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowReceipt(false)}
            >
              Fechar
            </Button>
            {isAdmin && canUseFiscalModule && (
              <Button variant="outline" onClick={() => void loadFiscalRuntime()} disabled={loadingFiscalRuntime}>
                {loadingFiscalRuntime ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Atualizar status fiscal
              </Button>
            )}
            <Button onClick={sendReceiptWhatsApp}>📱 Enviar WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
