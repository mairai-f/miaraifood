import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyDisplayName } from '@/hooks/use-company-display-name';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Plus, DollarSign, MessageCircle, Trash2, CheckCircle, Edit, X, User, ChevronDown, ChevronRight, Calendar, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { findClientByRef, getClientUniqueSlug } from '@/lib/clientSlug';
import {
  formatClientDateTime,
  isClientDateInLastSevenDays,
  isClientDateThisMonth,
  isClientDateToday,
  parseClientDate,
  toClientDateTimeInputValue,
  toUtcIsoString,
} from '@/lib/clientDateTime';
import { getPaymentLabel, groupPaymentSnapshotItems, parsePaymentAdjustmentDetails, parsePaymentType } from '@/lib/payment';
import { INTERNET_REQUIRED_MESSAGE, isInternetUnavailable, openExternalUrl } from '@/lib/openExternalUrl';
import { DEFAULT_COMPANY_NAME, fetchCompanyDisplayName } from '@/lib/company';
import { buildWhatsAppUrl, buildItemWhatsAppUrl, buildPaymentWhatsAppUrl } from '@/lib/whatsapp';
import { normalizePhone } from '@/lib/phone';
import { getAvailableClientCredit, getClientCreditLimit, getCreditLimitExceededMessage, normalizeCreditLimit } from '@/lib/creditLimit';
import { formatClientDebtDueDate, isClientDebtOverdue } from '@/lib/clientDebtDueDate';
import { verifyStoreAdminApproval } from '@/lib/adminApproval';
import { getDebtPaymentCreditedAmount, getDebtPaymentMaxAmount, getDebtPaymentValidationMessage } from '@/lib/debtPayment';
import { parseDecimalInput } from '@/lib/numberInput';
import { formatProductCode } from '@/lib/productCode';
import { toProductUppercase } from '@/lib/productSearch';
import { calculatePackagingPrice, filterProductsWithPackagings, packagingMatchesSearch } from '@/lib/productPackaging';
import { blocksSaleWithoutStock } from '@/lib/stockSalePolicy';
import type { Product, ProductPackaging } from '@/types';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';

type ClientEditPayload = {
  name: string;
  phone: string;
  credit_limit: number | null;
  debt_due_date: string | null;
};

type PendingProtectedAction =
  | { kind: 'debt'; debtEntryId: string }
  | { kind: 'history' }
  | { kind: 'client' }
  | { kind: 'credit'; changes: ClientEditPayload }
  | null;

const samePaymentMoment = (left?: string | null, right?: string | null) => {
  if (!left || !right) return false;
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) < 1000;
};

type HistoryItem = { kind: 'debt'; date: string; productName: string; quantity: number; total: number; packagingName?: string | null; registered_by?: string };
type DeletedHistoryItem = HistoryItem & { deleted_at?: string | null; deleted_reason?: string | null; deleted_by?: string | null };
type SelectedDebtProduct = { product: Product; packaging: ProductPackaging | null };
type DebtCartItem = {
  lineId: string;
  product: Product;
  quantity: number;
  packagingId: string | null;
};
const isManualDeletedDebtEntry = (entry: { manual_deleted?: boolean }) => entry.manual_deleted === true;
const isLegacyDeletedDebtEntry = (entry: { deleted: boolean; status: string; manual_deleted?: boolean }) =>
  entry.deleted === true && entry.status !== 'paid' && !isManualDeletedDebtEntry(entry);
const isVisibleDebtEntry = (entry: { deleted: boolean; status: string; manual_deleted?: boolean }) =>
  !isManualDeletedDebtEntry(entry) && !isLegacyDeletedDebtEntry(entry);

export default function ClientDetail() {
  const { clientRef } = useParams<{ clientRef: string }>();
  const navigate = useNavigate();
  const data = useData();
  const { username, isAdmin, ownerUserId, session } = useAuth();
  const companyDisplayName = useCompanyDisplayName();

  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<SelectedDebtProduct | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [showSearch, setShowSearch] = useState(false);
  const [cart, setCart] = useState<DebtCartItem[]>([]);
  const [submittingCart, setSubmittingCart] = useState(false);
  const submittingCartRef = useRef(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paymentAdminEmail, setPaymentAdminEmail] = useState('');
  const [paymentAdminPassword, setPaymentAdminPassword] = useState('');
  const [paymentAuthError, setPaymentAuthError] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [editEntry, setEditEntry] = useState<string | null>(null);
  const [editDateAdded, setEditDateAdded] = useState('');
  const [editDatePaid, setEditDatePaid] = useState('');
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('');
  const [editDebtDueDate, setEditDebtDueDate] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [customDateRange, setCustomDateRange] = useState<{ from: string; to: string } | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openPaymentGroups, setOpenPaymentGroups] = useState<Set<string>>(new Set());
  const [openPaymentItems, setOpenPaymentItems] = useState<Set<string>>(new Set());
  const [openHistoryItems, setOpenHistoryItems] = useState<Set<string>>(new Set());
  const [protectedAction, setProtectedAction] = useState<PendingProtectedAction>(null);
  const [deleteAuthOpen, setDeleteAuthOpen] = useState(false);
  const [deleteAuthEmail, setDeleteAuthEmail] = useState('');
  const [deleteAuthPassword, setDeleteAuthPassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingProtectedItem, setDeletingProtectedItem] = useState(false);

  const client = findClientByRef(data.clients.filter(c => !c.deleted), clientRef || '');
  const id = client?.id;

  const allClientEntries = useMemo(() => data.debtEntries.filter(d => d.client_id === id), [data.debtEntries, id]);
  const entries = useMemo(() => allClientEntries.filter(isVisibleDebtEntry), [allClientEntries]);
  const deletedEntries = useMemo(() => allClientEntries.filter(isManualDeletedDebtEntry), [allClientEntries]);
  const clientPayments = useMemo(() => data.payments.filter(p => p.client_id === id), [data.payments, id]);
  const parsedPayments = useMemo(
    () =>
      clientPayments.map(payment => {
        const parsedType = parsePaymentType(payment.type);
        const snapshot =
          parsedType.kind === 'total'
            ? groupPaymentSnapshotItems(
                allClientEntries
                  .filter(entry => isVisibleDebtEntry(entry) && entry.status === 'paid' && samePaymentMoment(entry.date_paid, payment.date))
                  .map(entry => ({
                    product_name: entry.product_name,
                    quantity: entry.quantity,
                    total: entry.total,
                    date_added: entry.date_added,
                    registered_by: entry.registered_by,
                  }))
              )
            : [];

        return { ...payment, parsedType, snapshot, adjustment: parsePaymentAdjustmentDetails(payment.details) };
      }),
    [allClientEntries, clientPayments]
  );
  const balance = id ? data.getClientBalance(id) : 0;
  const debtOverdue = isClientDebtOverdue(client?.debt_due_date, balance);
  const rawPaymentAmount = parseDecimalInput(payAmount);
  const rawDiscountValue = parseDecimalInput(discountValue);
  const calculatedDiscountAmount = discountOpen
    ? Math.min(
        balance,
        Math.max(0, discountType === 'percent' ? balance * Math.min(rawDiscountValue, 100) / 100 : rawDiscountValue)
      )
    : 0;
  const maximumPaymentAmount = getDebtPaymentMaxAmount(balance, calculatedDiscountAmount);
  const creditedPaymentAmount = getDebtPaymentCreditedAmount(balance, rawPaymentAmount, calculatedDiscountAmount);
  const remainingAfterPayment = Math.max(0, balance - creditedPaymentAmount);
  const hasPaymentDraft = payAmount.trim() !== '' || calculatedDiscountAmount > 0;
  const paymentValidationMessage = hasPaymentDraft
    ? getDebtPaymentValidationMessage(balance, rawPaymentAmount, calculatedDiscountAmount)
    : null;
  const clientCreditLimit = getClientCreditLimit(client);
  const availableCredit = getAvailableClientCredit(client, balance);
  const getDebtCartPricing = (item: DebtCartItem) => calculatePackagingPrice(
    item.product,
    item.quantity,
    data.productPackagings,
    item.packagingId,
  );
  const cartTotal = cart.reduce((sum, item) => sum + getDebtCartPricing(item).total, 0);
  const cartExceedsCreditLimit = clientCreditLimit !== null && cartTotal > (availableCredit ?? 0) + 0.009;
  const matched = filterProductsWithPackagings(
    data.products.filter(product => !product.deleted),
    data.productPackagings,
    productSearch,
  );
  const getCartQuantityForProduct = (productId: string) =>
    cart
      .filter(item => item.product.id === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  const getInsufficientStockMessage = (productId: string, productName: string, requestedQuantity: number) => {
    const product = data.products.find(item => item.id === productId);
    if (!product) return '';

    if (!blocksSaleWithoutStock(product, data.blockSaleWithoutStock)) return '';
    const availableStock = Number(product.stock || 0);

    return availableStock < requestedQuantity
      ? `Estoque insuficiente para ${product.name || productName}. Disponivel: ${availableStock}, solicitado: ${requestedQuantity}.`
      : '';
  };
  const validateCartStock = () => {
    const productIds = new Set(cart.map(item => item.product.id));
    for (const productId of productIds) {
      const product = cart.find(item => item.product.id === productId)?.product;
      if (!product) continue;
      const message = getInsufficientStockMessage(productId, product.name, getCartQuantityForProduct(productId));
      if (message) {
        toast.error(message);
        return false;
      }
    }

    return true;
  };

  // ── Agrupamento de pendentes por produto ───────────────────────────────────
  const groupedPending = useMemo(() => {
    const pending = entries.filter(e => e.status === 'pending');
    const groups = new Map<string, typeof pending>();

    for (const e of pending) {
      const key = e.product_name.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      name: items[0].product_name,
      totalQty: items.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: items.reduce((sum, item) => sum + item.total, 0),
      items: items.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()),
    }));
  }, [entries]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const togglePaymentGroup = (key: string) => {
    setOpenPaymentGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const togglePaymentItemGroup = (key: string) => {
    setOpenPaymentItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleHistoryItemGroup = (key: string) => {
    setOpenHistoryItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Histórico de dívidas filtrado (sem pagamentos) ─────────────────────────
  const filteredHistory = useMemo((): HistoryItem[] => {
    const all: HistoryItem[] = allClientEntries
      .filter(isVisibleDebtEntry)
      .map(e => ({ kind: 'debt' as const, date: e.date_added, productName: e.product_name, quantity: e.quantity, total: e.total, packagingName: e.packaging_name, registered_by: e.registered_by }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (historyFilter === 'daily') return all.filter(i => isClientDateToday(i.date));
    if (historyFilter === 'weekly') return all.filter(i => isClientDateInLastSevenDays(i.date));
    if (historyFilter === 'monthly') return all.filter(i => isClientDateThisMonth(i.date));

    if (historyFilter === 'custom') {
      if (!customDateRange) return [];
      return all.filter(item =>
        isWithinInterval(parseClientDate(item.date), {
          start: startOfDay(new Date(customDateRange.from + 'T00:00:00')),
          end: endOfDay(new Date(customDateRange.to + 'T00:00:00')),
        })
      );
    }

    return all;
  }, [allClientEntries, historyFilter, customDateRange]);

  const deletedHistory = useMemo((): DeletedHistoryItem[] => (
    deletedEntries
      .map(e => ({
        kind: 'debt' as const,
        date: e.date_added,
        productName: e.product_name,
        quantity: e.quantity,
        total: e.total,
        packagingName: e.packaging_name,
        registered_by: e.registered_by,
        deleted_at: e.deleted_at,
        deleted_reason: e.deleted_reason,
        deleted_by: e.deleted_by,
      }))
      .sort((a, b) => new Date(b.deleted_at || b.date).getTime() - new Date(a.deleted_at || a.date).getTime())
  ), [deletedEntries]);

  const groupedPayments = useMemo(
    () =>
      parsedPayments.map(payment => {
        const groups = new Map<string, typeof payment.snapshot>();

        for (const item of payment.snapshot) {
          const key = item.product_name.trim().toLowerCase();
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(item);
        }

        return {
          ...payment,
          groupedItems: Array.from(groups.entries()).map(([key, items]) => ({
            key: `${payment.id}:${key}`,
            name: items[0].product_name,
            totalQty: items.reduce((sum, item) => sum + item.quantity, 0),
            totalValue: items.reduce((sum, item) => sum + item.total, 0),
            items: items.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()),
          })),
        };
      }),
    [parsedPayments]
  );

  const groupedHistory = useMemo(() => {
    const groups = new Map<string, HistoryItem[]>();
    for (const item of filteredHistory) {
      const key = item.productName.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      name: items[0].productName,
      totalQty: items.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: items.reduce((sum, item) => sum + item.total, 0),
      items: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }));
  }, [filteredHistory]);

  const emptyHistoryMessage =
    historyFilter === 'custom'
      ? customDateRange
        ? 'Nenhum registro nesse período.'
        : 'Selecione o período e clique em Buscar.'
      : 'Nenhum registro.';

  if (data.loading) return (
    <div className="text-center mt-20 text-muted-foreground text-sm">Carregando...</div>
  );

  if (!client || !id) return (
    <div className="text-center mt-20 text-muted-foreground text-sm">
      Cliente não encontrado. <Button variant="link" onClick={() => navigate('/clientes')}>Voltar</Button>
    </div>
  );

  // ── CART handlers ──────────────────────────────────────────────────────────

  const handleAddToCart = () => {
    if (!selectedProduct) { toast.error('Selecione um produto'); return; }
    const qty = parseInt(quantity) || 1;
    const { product, packaging } = selectedProduct;
    const requestedQuantity = getCartQuantityForProduct(product.id) + qty;
    const stockMessage = getInsufficientStockMessage(product.id, product.name, requestedQuantity);
    if (stockMessage) {
      toast.error(stockMessage);
      return;
    }

    setCart(prev => {
      const lineId = `${product.id}:${packaging?.id ?? 'base'}`;
      const existing = prev.find(item => item.lineId === lineId);
      if (existing) return prev.map(item => item.lineId === lineId ? { ...item, quantity: item.quantity + qty } : item);
      return [...prev, { lineId, product, quantity: qty, packagingId: packaging?.id ?? null }];
    });
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity('1');
  };

  const handleRemoveFromCart = (lineId: string) => {
    setCart(prev => prev.filter(item => item.lineId !== lineId));
  };

  const handleSubmitCart = async (sendWhatsApp: boolean = true) => {
    if (submittingCartRef.current) return;
    if (cart.length === 0) { toast.error('Adicione pelo menos um produto'); return; }
    if (!validateCartStock()) return;
    if (clientCreditLimit !== null && cartExceedsCreditLimit) {
      toast.error(getCreditLimitExceededMessage(client.name, clientCreditLimit, balance, cartTotal));
      return;
    }

    submittingCartRef.current = true;
    setSubmittingCart(true);

    const dateAdded = new Date().toISOString();
    const submittedCart = [...cart];

    try {
      await data.addDebtEntries(
        submittedCart.map(item => {
          const pricing = getDebtCartPricing(item);
          return {
            clientId: id,
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: pricing.effectiveUnitPrice,
            total: pricing.total,
            packagingId: pricing.packaging?.id ?? null,
            packagingName: pricing.packaging?.name ?? null,
            packagingQuantity: pricing.packaging?.base_quantity ?? null,
            packagingPrice: pricing.packaging?.sale_price ?? null,
            dateAdded,
            registeredBy: username ?? undefined,
          };
        })
      );
    } catch (error) {
      console.error('Erro ao marcar produtos:', getRedactedLogValue(error));
      const message = getPublicErrorMessage(error, 'Nao foi possivel marcar os produtos');
      toast.error(message);
      submittingCartRef.current = false;
      setSubmittingCart(false);
      return;
    }

    const shouldNotifyWhatsApp = sendWhatsApp && Boolean(client.phone);

    toast.success(`${submittedCart.length} item(s) adicionado(s)${shouldNotifyWhatsApp ? '!' : ' (sem notificar)!'}`);

    if (shouldNotifyWhatsApp && isInternetUnavailable()) {
      toast.error(INTERNET_REQUIRED_MESSAGE);
      setCart([]);
      submittingCartRef.current = false;
      setSubmittingCart(false);
      return;
    }

    if (shouldNotifyWhatsApp) {
      const storeName = companyDisplayName !== DEFAULT_COMPANY_NAME || !ownerUserId
        ? companyDisplayName
        : await fetchCompanyDisplayName(ownerUserId);
      const submittedCartTotal = submittedCart.reduce((sum, item) => sum + getDebtCartPricing(item).total, 0);
      const newBalance = balance + submittedCartTotal;
      const cartEntries = submittedCart.map(item => {
        const pricing = getDebtCartPricing(item);
        return {
          id: '', client_id: id, product_id: item.product.id, product_name: item.product.name,
          quantity: item.quantity, unit_price: pricing.effectiveUnitPrice, total: pricing.total,
          packaging_id: pricing.packaging?.id ?? null,
          packaging_name: pricing.packaging?.name ?? null,
          packaging_quantity: pricing.packaging?.base_quantity ?? null,
          packaging_price: pricing.packaging?.sale_price ?? null,
          date_added: dateAdded, status: 'pending' as const, deleted: false,
          date_paid: null, registered_by: username,
        };
      });
      const url = buildItemWhatsAppUrl(client.phone, client.name, cartEntries, newBalance, storeName);
      if (!openExternalUrl(url)) {
        toast.error('Não foi possível abrir o WhatsApp.');
      }
    }

    setCart([]);
    submittingCartRef.current = false;
    setSubmittingCart(false);
  };

  const handlePayment = async () => {
    const amount = parseDecimalInput(payAmount);
    const paidAmount = Number(amount.toFixed(2));
    const discountAmount = Number(calculatedDiscountAmount.toFixed(2));
    const creditedAmount = getDebtPaymentCreditedAmount(balance, paidAmount, discountAmount);
    const validationMessage = getDebtPaymentValidationMessage(balance, paidAmount, discountAmount);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }
    const paymentDate = new Date().toISOString();
    const paymentDetails = discountAmount > 0
      ? {
          payment: {
            paid_amount: paidAmount,
            discount_amount: discountAmount,
            discount_type: discountType,
            discount_value: Number(rawDiscountValue.toFixed(2)),
            credited_amount: creditedAmount,
          },
        }
      : null;

    if (!session?.access_token) {
      setPaymentAuthError('Sua sessao expirou. Faca login novamente.');
      return;
    }

    if (!paymentAdminEmail.trim() || !paymentAdminPassword.trim()) {
      setPaymentAuthError('Informe login e senha do administrador.');
      return;
    }

    setProcessingPayment(true);
    setPaymentAuthError('');

    const approval = await verifyStoreAdminApproval(
      session.access_token,
      paymentAdminEmail,
      paymentAdminPassword,
      'fiado.manage',
    );

    if (!approval.success) {
      setProcessingPayment(false);
      setPaymentAuthError(approval.error || 'Nao foi possivel validar a autorizacao.');
      return;
    }

    try {
      if (creditedAmount >= balance) {
        await data.closeAllDebt(id, paymentDate, paymentDetails);
        toast.success(discountAmount > 0
          ? `Dívida quitada com R$ ${discountAmount.toFixed(2)} de desconto!`
          : '🎉 PARABÉNS! Você quitou sua dívida! 🏆 Todas as pendências foram resolvidas! 💯');
      } else {
        await data.addPayment(id, paidAmount, 'partial', paymentDate);
        toast.success(`Pagamento de R$ ${paidAmount.toFixed(2)} registrado!`);
      }

      if (client.phone) {
        if (isInternetUnavailable()) {
          toast.error(INTERNET_REQUIRED_MESSAGE);
        } else try {
          const storeName = companyDisplayName !== DEFAULT_COMPANY_NAME || !ownerUserId
            ? companyDisplayName
            : await fetchCompanyDisplayName(ownerUserId);
          const isFullPayment = creditedAmount >= balance;
          const newBalance = balance - creditedAmount;
          const remainingEntries = isFullPayment ? [] : entries.filter(e => e.status === 'pending');
          const url = buildPaymentWhatsAppUrl(client.phone, client.name, paidAmount, remainingEntries, Math.max(0, newBalance), storeName);
          if (!openExternalUrl(url)) {
            toast.error('Não foi possível abrir o WhatsApp.');
          }
        } catch (error) {
          console.error('Erro ao preparar cobranca do WhatsApp:', getRedactedLogValue(error));
          toast.error('Pagamento registrado, mas nao foi possivel preparar a mensagem do WhatsApp.');
        }
      }

      setPayAmount('');
      setPaymentAdminEmail('');
      setPaymentAdminPassword('');
      setPaymentAuthError('');
      setDiscountValue('');
      setDiscountOpen(false);
      setPayOpen(false);
    } catch (error) {
      console.error('Erro ao registrar pagamento:', getRedactedLogValue(error));
      const message = getPublicErrorMessage(error, 'Não foi possível registrar o pagamento');
      toast.error(message);
      return;
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleWhatsApp = async () => {
    if (!client.phone) { toast.error('Cliente sem telefone cadastrado'); return; }
    if (isInternetUnavailable()) {
      toast.error(INTERNET_REQUIRED_MESSAGE);
      return;
    }

    const storeName = companyDisplayName !== DEFAULT_COMPANY_NAME || !ownerUserId
      ? companyDisplayName
      : await fetchCompanyDisplayName(ownerUserId);
    const openEntries = entries.filter(e => e.status === 'pending');
    const url = buildWhatsAppUrl(client.phone, client.name, openEntries, clientPayments, balance, storeName);
    if (!openExternalUrl(url)) {
      toast.error('Não foi possível abrir o WhatsApp.');
    }
  };

  const handleSaveEdit = async (entryId: string) => {
    const updates: Record<string, unknown> = {};
    if (editDateAdded) {
      updates.date_added = toUtcIsoString(editDateAdded);
    }
    if (editDatePaid) {
      updates.date_paid = toUtcIsoString(editDatePaid);
    }
    await data.updateDebtEntry(entryId, updates);
    setEditEntry(null); toast.success('Atualizado!');
  };

  const buildClientEditPayload = (): ClientEditPayload => ({
    name: editName,
    phone: normalizePhone(editPhone),
    credit_limit: normalizeCreditLimit(editCreditLimit),
    debt_due_date: editDebtDueDate || null,
  });

  const applyClientEdit = async (changes: ClientEditPayload) => {
    await data.updateClient(id, changes);
    setEditClientOpen(false); toast.success('Cliente atualizado!');
    const updatedSlug = getClientUniqueSlug({ ...client, name: changes.name }, data.clients);
    if (updatedSlug !== clientRef) navigate(`/cliente/${updatedSlug}`, { replace: true });
  };

  const handleEditClient = async () => {
    const changes = buildClientEditPayload();
    if (changes.credit_limit !== clientCreditLimit) {
      openProtectedAction({ kind: 'credit', changes });
      return;
    }

    await applyClientEdit(changes);
  };

  const openProtectedAction = (target: PendingProtectedAction) => {
    if (!isAdmin && (target?.kind === 'debt' || target?.kind === 'history')) {
      toast.error('Operador não pode excluir itens da caderneta.');
      return;
    }

    setProtectedAction(target);
    setDeleteAuthEmail('');
    setDeleteAuthPassword('');
    setDeleteReason('');
    setDeleteAuthOpen(true);
  };

  const verifyAdminCredentials = async () => {
    if (!session?.access_token) {
      toast.error('Sua sessao expirou. Faca login novamente.');
      return false;
    }

    if (!deleteAuthEmail.trim() || !deleteAuthPassword.trim()) {
      toast.error('Informe email e senha do administrador.');
      return false;
    }

    const approval = await verifyStoreAdminApproval(
      session.access_token,
      deleteAuthEmail,
      deleteAuthPassword,
    );

    if (!approval.success) {
      toast.error(approval.error || 'Nao foi possivel validar o administrador.');
      return false;
    }

    return true;
  };

  const handleProtectedAction = async () => {
    if (!protectedAction) return;

    if (protectedAction.kind === 'debt' && !deleteReason.trim()) {
      toast.error('Informe o motivo da exclusão do item.');
      return;
    }

    setDeletingProtectedItem(true);

    try {
      const verified = await verifyAdminCredentials();
      if (!verified) return;

      if (protectedAction.kind === 'debt') {
        await data.deleteDebtEntry(protectedAction.debtEntryId, deleteReason);
        toast.success('Item removido da caderneta.');
      } else if (protectedAction.kind === 'history') {
        await data.deleteClientHistory(id);
        toast.success('Histórico de produtos excluído.');
      } else if (protectedAction.kind === 'client') {
        await data.softDeleteClient(id);
        toast.success('Cliente excluído.');
        navigate('/clientes');
      } else {
        await applyClientEdit(protectedAction.changes);
      }

      setDeleteAuthOpen(false);
      setProtectedAction(null);
      setDeleteAuthPassword('');
    } catch (error) {
      toast.error(getPublicErrorMessage(error, 'Não foi possível concluir a operação.'));
    } finally {
      setDeletingProtectedItem(false);
    }
  };

  const handleApplyCustomFilter = () => {
    if (!customDateFrom || !customDateTo) {
      toast.error('Selecione a data inicial e final');
      return;
    }
    if (new Date(customDateFrom) > new Date(customDateTo)) {
      toast.error('A data inicial deve ser menor ou igual à data final');
      return;
    }
    setCustomDateRange({ from: customDateFrom, to: customDateTo });
  };

  return (
    <div>
      {/* Header */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')} className="mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />Voltar
      </Button>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{client.name}</h1>
          {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
          {balance > 0 && client.debt_due_date && (
            <p className={`mt-1 flex items-center gap-1 text-xs ${debtOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
              <Calendar className="h-3 w-3" />
              {debtOverdue ? 'Pagamento atrasado: ' : 'Pagamento previsto: '}
              {formatClientDebtDueDate(client.debt_due_date)}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditName(client.name);
                setEditPhone(client.phone);
                setEditCreditLimit(clientCreditLimit === null ? '' : clientCreditLimit.toFixed(2));
                setEditDebtDueDate(client.debt_due_date || '');
                setEditClientOpen(true);
              }}
              className="flex-1 sm:flex-none"
            >
              <User className="h-3 w-3 mr-1" />Editar
            </Button>
            <Button variant="outline" size="sm" onClick={handleWhatsApp} className="flex-1 sm:flex-none">
              <MessageCircle className="h-3 w-3 mr-1" />WhatsApp
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => openProtectedAction({ kind: 'client' })}
          >
            <Trash2 className="h-3 w-3 mr-1" />Excluir
          </Button>
        </div>
      </div>

      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mb-4 border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Saldo Devedor</p>
                <p className={`text-2xl font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>R$ {balance.toFixed(2)}</p>
                {clientCreditLimit !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Limite: R$ {clientCreditLimit.toFixed(2)} | Disponivel: R$ {(availableCredit ?? 0).toFixed(2)}
                  </p>
                )}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setPayOpen(true)} disabled={balance <= 0}>
                  <DollarSign className="h-3 w-3 mr-1" />Pagamento
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="debts">
        <TabsList className="mb-3 w-full sm:w-auto">
          <TabsTrigger value="debts" className="flex-1 sm:flex-none">Dívidas</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none">Histórico</TabsTrigger>
          <TabsTrigger value="deleted" className="flex-1 sm:flex-none">Itens apagados</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 sm:flex-none">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="debts">
          {/* Add Debt with Cart */}
          <Card className="mb-4 border-border/50">
            <CardHeader className="px-4 pt-4 pb-2"><CardTitle className="text-sm">Adicionar Dívida</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="relative">
                  <Label className="text-xs">Produto</Label>
                  <Input
                    value={selectedProduct
                      ? `${selectedProduct.product.name}${selectedProduct.packaging ? ` · ${selectedProduct.packaging.name}` : ''}`
                      : productSearch}
                    onChange={e => { setProductSearch(toProductUppercase(e.target.value)); setSelectedProduct(null); setShowSearch(true); }}
                    onFocus={() => setShowSearch(true)}
                    placeholder="Buscar produto pelo nome, código ou barras..."
                    className="text-sm"
                  />
                  {showSearch && productSearch && !selectedProduct && (
                    <div className="absolute z-10 top-full left-0 right-0 bg-popover border border-border rounded-lg mt-1 max-h-40 overflow-auto shadow-lg">
                      {matched.map(product => {
                        const packaging = data.productPackagings.find(item => (
                          item.product_id === product.id && packagingMatchesSearch(item, productSearch)
                        )) ?? null;
                        return (
                          <button key={product.id} className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex justify-between gap-3 text-sm"
                            onClick={() => {
                              setSelectedProduct({ product, packaging });
                              setQuantity(String(packaging?.base_quantity ?? 1));
                              setProductSearch('');
                              setShowSearch(false);
                            }}>
                            <span className="min-w-0">
                              <span className="block truncate">{formatProductCode(product.code) ? `${formatProductCode(product.code)} ` : ''}{product.name}</span>
                              {packaging && <span className="block text-xs text-primary">{packaging.name} · {packaging.base_quantity} unidades</span>}
                            </span>
                            <span className="text-muted-foreground whitespace-nowrap">R$ {(packaging?.sale_price ?? product.price).toFixed(2)}</span>
                          </button>
                        );
                      })}
                      {matched.length === 0 && <p className="px-3 py-2 text-muted-foreground text-xs">Nenhum produto</p>}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <div>
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="text-sm" />
                  </div>
                </div>
                <Button onClick={handleAddToCart} variant="outline" className="w-full sm:w-auto" size="sm">
                  <Plus className="h-3 w-3 mr-1" />Adicionar à lista
                </Button>

                {/* Cart */}
                {cart.length > 0 && (
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground">
                      Lista ({cart.length} item{cart.length > 1 ? 's' : ''}):
                    </p>
                    {cart.map(item => {
                      const pricing = getDebtCartPricing(item);
                      return (
                        <div key={item.lineId} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate min-w-0">
                            {item.product.name} <span className="text-muted-foreground">x{item.quantity}</span>
                            {pricing.packaging && (
                              <span className="block text-xs text-primary">
                                {pricing.packageCount} × {pricing.packaging.name}
                                {pricing.remainderQuantity > 0 ? ` + ${pricing.remainderQuantity} un.` : ''}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-medium">R$ {pricing.total.toFixed(2)}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveFromCart(item.lineId)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="border-t border-border pt-2 flex items-center justify-between text-sm font-bold">
                      <span>Total:</span>
                      <span>R$ {cartTotal.toFixed(2)}</span>
                    </div>
                    {cartExceedsCreditLimit && clientCreditLimit !== null && (
                      <p className="text-xs font-medium text-destructive">
                        Limite excedido. Disponivel: R$ {(availableCredit ?? 0).toFixed(2)}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={() => handleSubmitCart(false)} variant="outline" className="flex-1" size="sm" disabled={submittingCart || cartExceedsCreditLimit}>
                        <CheckCircle className="h-3 w-3 mr-1" />{submittingCart ? 'Marcando...' : 'Marcar'}
                      </Button>
                      <Button onClick={() => handleSubmitCart(true)} className="flex-1" size="sm" disabled={submittingCart || cartExceedsCreditLimit}>
                        <MessageCircle className="h-3 w-3 mr-1" />{submittingCart ? 'Marcando...' : 'Marcar e Enviar'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Debts — agrupadas por produto */}
          <div className="space-y-2">
            {groupedPending.map(group => (
              <Card key={group.key} className="border-border/50">
                <Collapsible open={openGroups.has(group.key)} onOpenChange={() => toggleGroup(group.key)}>
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-3 cursor-pointer hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {openGroups.has(group.key)
                            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{group.name}</p>
                            <p className="text-xs text-muted-foreground">{group.totalQty}x — {group.items.length} registro{group.items.length > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <span className="font-bold text-destructive text-sm shrink-0">R$ {group.totalValue.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border mx-3">
                      {group.items.map(e => (
                        <div key={e.id} className="py-2 border-b border-border/50 last:border-0">
                          {editEntry === e.id ? (
                            <div className="space-y-2 px-1">
                              <p className="text-sm font-medium">{e.product_name} x{e.quantity}</p>
                              <div className="flex gap-2">
                                <div className="flex-1"><Label className="text-xs">Data/Hora pego</Label><Input type="datetime-local" className="h-8 text-xs" value={editDateAdded} onChange={ev => setEditDateAdded(ev.target.value)} /></div>
                                <div className="flex-1"><Label className="text-xs">Data/Hora pago</Label><Input type="datetime-local" className="h-8 text-xs" value={editDatePaid} onChange={ev => setEditDatePaid(ev.target.value)} /></div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1" onClick={() => handleSaveEdit(e.id)}>Salvar</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditEntry(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2 px-1">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted-foreground">
                                  x{e.quantity} — {formatClientDateTime(e.date_added)}
                                  {e.date_paid && ` • Pago: ${formatClientDateTime(e.date_paid)}`}
                                </p>
                                {e.packaging_name && <p className="text-xs font-medium text-primary">Embalagem: {e.packaging_name}</p>}
                                {e.registered_by && <p className="text-xs text-muted-foreground">Por: {e.registered_by}</p>}
                                <p className="text-xs text-muted-foreground">Estoque: saída vinculada ao fiado</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-medium text-destructive text-xs">R$ {e.total.toFixed(2)}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                  setEditEntry(e.id);
                                  setEditDateAdded(toClientDateTimeInputValue(e.date_added));
                                  if (e.date_paid) {
                                    setEditDatePaid(toClientDateTimeInputValue(e.date_paid));
                                  } else {
                                    setEditDatePaid('');
                                  }
                                }}><Edit className="h-3 w-3" /></Button>
                                {isAdmin && (
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openProtectedAction({ kind: 'debt', debtEntryId: e.id })}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
            {groupedPending.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma dívida pendente.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="flex flex-col gap-3 mb-3">
            <div className="flex gap-1.5 flex-wrap items-center">
              {(['all', 'daily', 'weekly', 'monthly', 'custom'] as const).map(f => (
                <Button key={f} variant={historyFilter === f ? 'default' : 'outline'} size="sm" className="text-xs px-2.5" onClick={() => setHistoryFilter(f)}>
                  {{ all: 'Tudo', daily: 'Hoje', weekly: '7 dias', monthly: 'Mês', custom: 'Personalizado' }[f]}
                </Button>
              ))}
              {isAdmin && (
                <Button variant="destructive" size="sm" className="text-xs" onClick={() => openProtectedAction({ kind: 'history' })}>
                  <Trash2 className="h-3 w-3 mr-1" />Limpar Produtos
                </Button>
              )}
            </div>

            {/* Filtro de data personalizado */}
            {historyFilter === 'custom' && (
              <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />De</Label>
                    <Input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} className="text-sm h-9" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />Até</Label>
                    <Input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} className="text-sm h-9" />
                  </div>
                  <Button className="w-full sm:w-auto self-end" onClick={handleApplyCustomFilter} disabled={!customDateFrom || !customDateTo}>
                    Buscar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Mostra registros dentro do intervalo escolhido.</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {groupedHistory.map(group => (
              <Card key={group.key} className="border-border/50">
                <Collapsible open={openHistoryItems.has(group.key)} onOpenChange={() => toggleHistoryItemGroup(group.key)}>
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-3 cursor-pointer hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {openHistoryItems.has(group.key)
                            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{group.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.totalQty}x — {group.items.length} registro{group.items.length > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-destructive font-medium text-sm whitespace-nowrap">- R$ {group.totalValue.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t border-border mx-3">
                      {group.items.map((item, index) => (
                        <div key={`${group.key}-${item.date}-${index}`} className="py-2 border-b border-border/50 last:border-0">
                          <div className="flex items-start justify-between gap-2 px-1">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.productName} x{item.quantity}</p>
                              {item.packagingName && <p className="text-xs font-medium text-primary">Embalagem: {item.packagingName}</p>}
                              <p className="text-xs text-muted-foreground">{formatClientDateTime(item.date)}</p>
                              {item.registered_by && <p className="text-xs text-muted-foreground">Por: {item.registered_by}</p>}
                            </div>
                            <span className="text-destructive font-medium text-sm whitespace-nowrap">- R$ {item.total.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
            {filteredHistory.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">{emptyHistoryMessage}</p>}
          </div>
        </TabsContent>

        <TabsContent value="deleted">
          <div className="space-y-1.5">
            {deletedHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">Nenhum item apagado desse cliente.</p>
            ) : deletedHistory.map((item, i) => (
              <Card key={`${item.productName}-${i}`} className="border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName} x{item.quantity}</p>
                      {item.packagingName && <p className="text-xs font-medium text-primary">Embalagem: {item.packagingName}</p>}
                      <p className="text-xs text-muted-foreground">Lançado em {formatClientDateTime(item.date)}</p>
                      <p className="text-xs text-muted-foreground">Apagado em {item.deleted_at ? formatClientDateTime(item.deleted_at) : '-'}</p>
                    </div>
                    <span className="text-destructive font-medium text-sm whitespace-nowrap">R$ {item.total.toFixed(2)}</span>
                  </div>
                  {item.deleted_by && (
                    <p className="text-xs text-muted-foreground">Apagado por: {item.deleted_by}</p>
                  )}
                  {item.deleted_reason && (
                    <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Motivo</p>
                      <p className="text-sm">{item.deleted_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="space-y-1.5">
            {groupedPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">Nenhum pagamento registrado.</p>
            ) : (
              [...groupedPayments]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((p, i) => (
                  <Card key={i} className="border-border/50">
                    <Collapsible open={openPaymentGroups.has(p.id)} onOpenChange={() => togglePaymentGroup(p.id)}>
                      <CollapsibleTrigger asChild>
                        <CardContent className="p-3 cursor-pointer hover:bg-accent/30 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {openPaymentGroups.has(p.id)
                                ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-success">{getPaymentLabel(p.type)}</p>
                                <p className="text-xs text-muted-foreground">{formatClientDateTime(p.date)}</p>
                                {p.groupedItems.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {p.groupedItems.length} produto{p.groupedItems.length > 1 ? 's' : ''} quitado{p.groupedItems.length > 1 ? 's' : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-success font-medium text-sm whitespace-nowrap">
                                + R$ {p.amount.toFixed(2)}
                              </span>
                              {p.adjustment?.discountAmount ? (
                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                  Pago R$ {p.adjustment.paidAmount.toFixed(2)} + desc. R$ {p.adjustment.discountAmount.toFixed(2)}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t border-border mx-3">
                          {p.adjustment?.discountAmount ? (
                            <div className="border-b border-border/50 py-3 text-xs text-muted-foreground">
                              <p>Valor pago: <span className="font-medium text-foreground">R$ {p.adjustment.paidAmount.toFixed(2)}</span></p>
                              <p>
                                Desconto: <span className="font-medium text-foreground">R$ {p.adjustment.discountAmount.toFixed(2)}</span>
                                {p.adjustment.discountType === 'percent' ? ` (${p.adjustment.discountValue.toFixed(2)}%)` : ''}
                              </p>
                              <p>Total abatido: <span className="font-medium text-foreground">R$ {p.adjustment.creditedAmount.toFixed(2)}</span></p>
                            </div>
                          ) : null}
                          {p.groupedItems.length > 0 ? (
                            p.groupedItems.map(group => (
                              group.items.length > 1 ? (
                                <Collapsible
                                  key={group.key}
                                  open={openPaymentItems.has(group.key)}
                                  onOpenChange={() => togglePaymentItemGroup(group.key)}
                                >
                                  <CollapsibleTrigger asChild>
                                    <div className="py-2 border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/20 transition-colors">
                                      <div className="flex items-center justify-between gap-2 px-1">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          {openPaymentItems.has(group.key)
                                            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{group.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {group.totalQty}x - {group.items.length} registro{group.items.length > 1 ? 's' : ''}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="text-xs font-medium whitespace-nowrap">R$ {group.totalValue.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent>
                                    <div className="pb-2 px-1 space-y-2">
                                      {group.items.map((item, index) => (
                                        <div key={`${group.key}-${index}`} className="flex items-start justify-between gap-2 text-sm">
                                          <div className="min-w-0">
                                            <p className="font-medium truncate">{item.product_name} x{item.quantity}</p>
                                            <p className="text-xs text-muted-foreground">{formatClientDateTime(item.date_added)}</p>
                                            {item.registered_by && <p className="text-xs text-muted-foreground">Por: {item.registered_by}</p>}
                                          </div>
                                          <span className="text-xs font-medium whitespace-nowrap">R$ {item.total.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ) : (
                                <div key={group.key} className="py-2 border-b border-border/50 last:border-0">
                                  <div className="flex items-start justify-between gap-2 px-1 text-sm">
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{group.items[0].product_name} x{group.items[0].quantity}</p>
                                      <p className="text-xs text-muted-foreground">{formatClientDateTime(group.items[0].date_added)}</p>
                                      {group.items[0].registered_by && <p className="text-xs text-muted-foreground">Por: {group.items[0].registered_by}</p>}
                                    </div>
                                    <span className="text-xs font-medium whitespace-nowrap">R$ {group.items[0].total.toFixed(2)}</span>
                                  </div>
                                </div>
                              )
                            ))
                          ) : (
                            <div className="py-3 text-xs text-muted-foreground">Nenhum produto vinculado a este pagamento.</div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog
        open={payOpen}
        onOpenChange={(open) => {
          setPayOpen(open);
          setPaymentAuthError('');
          setProcessingPayment(false);
          setPaymentAdminPassword('');
          setPaymentAdminEmail('');
          if (!open) {
            setPayAmount('');
            setDiscountValue('');
            setDiscountOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="max-h-[72svh] space-y-3 overflow-y-auto pr-1 sm:max-h-[76svh] sm:space-y-4">
            <div className="space-y-2">
              <Label>Valor do Pagamento (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                max={maximumPaymentAmount.toFixed(2)}
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">
                Valor máximo permitido agora: <span className="font-medium text-foreground">R$ {maximumPaymentAmount.toFixed(2)}</span>
              </p>
              {paymentValidationMessage ? (
                <p className="text-xs font-medium text-destructive">{paymentValidationMessage}</p>
              ) : null}
            </div>
            
            <div className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-2.5 sm:p-3">
              <Button
                type="button"
                variant={discountOpen ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setDiscountOpen(open => !open)}
              >
                <Percent className="mr-2 h-4 w-4" />
                {discountOpen ? 'Remover desconto' : 'Adicionar desconto'}
              </Button>

              {discountOpen && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Desconto permitido somente em pagamento total.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={discountType === 'amount' ? 'default' : 'outline'}
                      onClick={() => setDiscountType('amount')}
                    >
                      R$
                    </Button>
                    <Button
                      type="button"
                      variant={discountType === 'percent' ? 'default' : 'outline'}
                      onClick={() => setDiscountType('percent')}
                    >
                      %
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>{discountType === 'amount' ? 'Desconto (R$)' : 'Desconto (%)'}</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      max={discountType === 'percent' ? 100 : undefined}
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      placeholder={discountType === 'amount' ? '0,00' : '0'}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between mb-1.5 text-muted-foreground">
                <span>Dívida Total:</span>
                <span className="font-medium">R$ {balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-1.5 text-muted-foreground">
                <span>Valor Pago:</span>
                <span className="font-medium">R$ {calculatedDiscountAmount > 0 ? (payAmount ? Number.parseFloat(payAmount.replace(',', '.')) : 0).toFixed(2) : creditedPaymentAmount.toFixed(2)}</span>
              </div>
              {calculatedDiscountAmount > 0 && (
                <div className="flex justify-between mb-1.5 text-success">
                  <span>Desconto Aplicado:</span>
                  <span className="font-medium">R$ {calculatedDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between mt-3 pt-3 border-t border-border/50 font-bold">
                <span>Saldo Restante:</span>
                <span className={remainingAfterPayment <= 0 ? 'text-success' : 'text-destructive'}>
                  R$ {remainingAfterPayment.toFixed(2)}
                </span>
              </div>
              {remainingAfterPayment <= 0 && creditedPaymentAmount > 0 && (
                <div className="mt-3 text-xs font-semibold text-success bg-success/15 p-2 rounded text-center">
                  ✓ A dívida será totalmente quitada!
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-2.5 sm:p-3">
              <p className="text-sm font-medium">Autorizacao do administrador</p>
              <p className="text-xs text-muted-foreground">
                Para registrar pagamento de conta no fiado, informe o login e a senha do administrador da loja.
              </p>
              <div className="space-y-2">
                <Label>Login do administrador</Label>
                <Input
                  type="email"
                  name="client-payment-admin-login"
                  value={paymentAdminEmail}
                  onChange={event => setPaymentAdminEmail(event.target.value)}
                  placeholder="admin@empresa.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha do administrador</Label>
                <PasswordInput
                  name="client-payment-admin-password"
                  value={paymentAdminPassword}
                  onChange={event => setPaymentAdminPassword(event.target.value)}
                  placeholder="Digite a senha"
                  autoComplete="new-password"
                />
              </div>
              {paymentAuthError ? (
                <p className="text-xs font-medium text-destructive">{paymentAuthError}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button className="w-full" onClick={handlePayment} disabled={processingPayment || Boolean(paymentValidationMessage)}>
                {processingPayment ? 'Validando...' : 'Confirmar'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setPayAmount(maximumPaymentAmount.toFixed(2))}
                disabled={processingPayment}
              >
                Pagar Tudo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={editName} onChange={e => setEditName(toProductUppercase(e.target.value))} /></div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
              <p className="text-xs text-muted-foreground">DDI 55 será adicionado automaticamente</p>
            </div>
            <div className="space-y-2">
              <Label>Limite de crédito (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={editCreditLimit}
                onChange={e => setEditCreditLimit(e.target.value)}
                placeholder="Sem limite"
              />
            </div>
            <div className="space-y-2">
              <Label>Data prevista para pagamento do fiado</Label>
              <Input type="date" value={editDebtDueDate} onChange={e => setEditDebtDueDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Deixe vazio para não definir vencimento.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={handleEditClient} className="w-full sm:w-auto">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAuthOpen} onOpenChange={setDeleteAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {protectedAction?.kind === 'credit'
                ? 'Confirmar alteração de limite'
                : protectedAction?.kind === 'client'
                  ? 'Confirmar exclusão do cliente'
                  : 'Confirmar exclusão na caderneta'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {protectedAction?.kind === 'credit'
                ? 'Para alterar o limite de crédito, informe o email e a senha do administrador.'
                : protectedAction?.kind === 'client'
                  ? 'Para excluir este cliente, informe o email e a senha do administrador.'
                  : 'Para excluir um item ou limpar o histórico da caderneta, informe o email e a senha do administrador.'}
            </p>
            <div className="space-y-2">
              <Label>Email do administrador</Label>
              <Input
                type="email"
                name="client-protected-action-admin-login"
                value={deleteAuthEmail}
                onChange={event => setDeleteAuthEmail(event.target.value)}
                placeholder="admin@empresa.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <PasswordInput
                name="client-protected-action-admin-password"
                value={deleteAuthPassword}
                onChange={event => setDeleteAuthPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            {protectedAction?.kind === 'debt' && (
              <div className="space-y-2">
                <Label>Motivo da exclusão</Label>
                <Input
                  value={deleteReason}
                  onChange={event => setDeleteReason(event.target.value)}
                  placeholder="Ex: item lançado em duplicidade"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAuthOpen(false)} disabled={deletingProtectedItem}>
              Cancelar
            </Button>
            <Button onClick={() => void handleProtectedAction()} disabled={deletingProtectedItem}>
              {protectedAction?.kind === 'credit' ? 'Confirmar alteração' : 'Confirmar exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
