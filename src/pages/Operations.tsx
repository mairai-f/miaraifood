import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Barcode, Boxes, CalendarClock, Check, CheckCircle2, Edit, FileDown, Loader2, MessageCircle, PackageCheck, PackagePlus, Percent, Plus, RefreshCw, Search, ShieldCheck, Trash2, Truck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { OperationsMetricCard } from '@/components/operations/OperationsMetricCard';
import type { SupplierOrderItem } from '@/components/operations/SupplierOrderDialog';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { supabase } from '@/integrations/supabase/client';
import { parseDecimalInput } from '@/lib/numberInput';
import { getLocalIsoDate } from '@/lib/clientDebtDueDate';
import { filterProductsBySearch, toProductUppercase } from '@/lib/productSearch';
import { normalizePhone } from '@/lib/phone';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { formatProductCode } from '@/lib/productCode';
import { buildSupplierOrderWhatsAppUrl } from '@/lib/whatsapp';
import type { FinancialAccount, OpenDebtClient, OperationsDetail, ProductBatch, ProductPromotion, PurchaseOrder, PurchaseOrderItem, SupplierRecord, SupplierSummary } from '@/types/operations';
import { getRedactedLogValue } from '../../shared/security/redaction';

const OperationsDetailsDialog = lazy(() =>
  import('@/components/operations/OperationsDetailsDialog').then((module) => ({
    default: module.OperationsDetailsDialog,
  })),
);

const SupplierOrderDialog = lazy(() =>
  import('@/components/operations/SupplierOrderDialog').then((module) => ({
    default: module.SupplierOrderDialog,
  })),
);

const fromTable = (table: string) => supabase.from(table as never);
const operationsRpc = supabase as unknown as {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
};
const today = getLocalIsoDate;
const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
const parseMoney = (value: string) => Math.max(0, parseDecimalInput(value));
const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
const daysUntil = (value: string) => {
  const date = new Date(`${value}T00:00:00`).getTime();
  const now = new Date(`${today()}T00:00:00`).getTime();
  return Math.ceil((date - now) / 86400000);
};
const dateAfterDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, days));
  return getLocalIsoDate(date);
};
const createEmptySupplierForm = () => ({
  id: '',
  name: '',
  whatsapp: '',
  document: '',
  contact_name: '',
  email: '',
  payment_terms_days: '0',
  delivery_lead_days: '0',
  minimum_order: '',
  notes: '',
});
const supplierFormFromRecord = (record: SupplierRecord | undefined, fallbackName = '') => ({
  id: record?.id ?? '',
  name: record?.name ?? fallbackName,
  whatsapp: record?.whatsapp ?? '',
  document: record?.document ?? '',
  contact_name: record?.contact_name ?? '',
  email: record?.email ?? '',
  payment_terms_days: String(record?.payment_terms_days ?? 0),
  delivery_lead_days: String(record?.delivery_lead_days ?? 0),
  minimum_order: record?.minimum_order ? String(record.minimum_order) : '',
  notes: record?.notes ?? '',
});
const purchaseStatusLabel = (status: string) => ({
  open: 'Aberto',
  partially_received: 'Recebido parcialmente',
  received: 'Recebido',
  canceled: 'Cancelado',
}[status] ?? status);

export default function Operations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, ownerUserId } = useAuth();
  const {
    products,
    clients,
    debtEntries,
    sales,
    saleItems,
    stockMovements,
    expenses,
    getClientBalance,
    offlinePreparationStatus,
    offlinePreparationMessage,
    offlineSnapshotUpdatedAt,
    loading: dataLoading,
    syncNow,
  } = useData();
  const { scope: operationalScope } = useOperationalScope();
  const operationalLocationId = operationalScope?.location.id ?? null;
  const effectiveOwnerId = ownerUserId ?? user?.id ?? '';
  const activeProducts = useMemo(() => products.filter((product) => !product.deleted), [products]);

  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseOrderItem[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [detail, setDetail] = useState<OperationsDetail | null>(null);
  const [supplierOrderOpen, setSupplierOrderOpen] = useState(false);
  const [supplierOrderInitialId, setSupplierOrderInitialId] = useState('');
  const [activeTab, setActiveTab] = useState('compras');
  const [syncing, setSyncing] = useState(false);
  const [purchaseDraftItems, setPurchaseDraftItems] = useState<SupplierOrderItem[]>([]);
  const [receivingPurchase, setReceivingPurchase] = useState<PurchaseOrder | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});
  const [receiveCreatePayable, setReceiveCreatePayable] = useState(false);
  const [receiveDueDate, setReceiveDueDate] = useState(today());
  const [receiving, setReceiving] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState('all');

  const handleManualSync = useCallback(async () => {
    if (syncing) return;

    setSyncing(true);
    try {
      await syncNow();
      toast.success('Backup e sincronizacao atualizados.');
    } catch (error) {
      console.error('Erro ao sincronizar manualmente:', getRedactedLogValue(error));
      toast.error('Nao foi possivel sincronizar agora.');
    } finally {
      setSyncing(false);
    }
  }, [syncNow, syncing]);

  const [purchaseForm, setPurchaseForm] = useState({
    supplier_name: '',
    supplier_id: '',
    invoice_number: '',
    purchase_date: today(),
    product_id: '',
    quantity: '',
    unit_cost: '',
    freight_amount: '',
    tax_amount: '',
    due_date: today(),
    create_payable: true,
    receive_stock: true,
    notes: '',
  });
  const [purchaseProductSearch, setPurchaseProductSearch] = useState('');

  const [accountForm, setAccountForm] = useState({
    account_type: 'payable' as 'payable' | 'receivable',
    description: '',
    party_name: '',
    amount: '',
    due_date: today(),
    notes: '',
  });

  const [labelForm, setLabelForm] = useState({ product_id: '', quantity: '12' });
  const [labelProductSearch, setLabelProductSearch] = useState('');
  const [promotionForm, setPromotionForm] = useState({
    product_id: '',
    title: '',
    discount_type: 'amount' as 'amount' | 'percent' | 'fixed_price',
    discount_value: '',
    starts_at: today(),
    ends_at: '',
    notes: '',
  });
  const [batchForm, setBatchForm] = useState({
    product_id: '',
    batch_code: '',
    quantity: '',
    expiration_date: today(),
    alert_days: '30',
    notes: '',
  });
  const [batchProductSearch, setBatchProductSearch] = useState('');
  const [batchToRemove, setBatchToRemove] = useState<ProductBatch | null>(null);
  const [removingBatch, setRemovingBatch] = useState(false);
  const [supplierForm, setSupplierForm] = useState(createEmptySupplierForm);

  const selectedBatchProduct = useMemo(
    () => activeProducts.find((product) => product.id === batchForm.product_id) ?? null,
    [activeProducts, batchForm.product_id],
  );
  const batchProductResults = useMemo(
    () => batchProductSearch.trim() && !selectedBatchProduct
      ? filterProductsBySearch(activeProducts, batchProductSearch).slice(0, 8)
      : [],
    [activeProducts, batchProductSearch, selectedBatchProduct],
  );
  const batchToRemoveProduct = batchToRemove?.product_id
    ? products.find((product) => product.id === batchToRemove.product_id) ?? null
    : null;

  const expiringBatches = useMemo(
    () => batches.filter((batch) => daysUntil(batch.expiration_date) <= Number(batch.alert_days ?? 30)),
    [batches],
  );

  const todaySales = useMemo(
    () => sales.filter((sale) => sale.date?.slice(0, 10) === today() && sale.status !== 'canceled'),
    [sales],
  );

  const todaySaleIds = useMemo(() => new Set(todaySales.map((sale) => sale.id)), [todaySales]);

  const todaySaleItems = useMemo(
    () => saleItems.filter((item) => todaySaleIds.has(item.sale_id)),
    [saleItems, todaySaleIds],
  );

  const todayGrossTotal = useMemo(
    () => todaySales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
    [todaySales],
  );

  const todayProfitTotal = useMemo(
    () => todaySaleItems
      .reduce((sum, item) => {
        const fallbackProfit = Number(item.net_total ?? item.total ?? 0) - Number(item.cost_price ?? 0) * Number(item.quantity ?? 0);
        return sum + Number(item.total_profit ?? fallbackProfit);
      }, 0),
    [todaySaleItems],
  );

  const currentMonth = today().slice(0, 7);
  const monthExpenses = useMemo(
    () => expenses.filter((expense) => expense.date?.slice(0, 7) === currentMonth),
    [expenses, currentMonth],
  );
  const monthExpensesTotal = useMemo(
    () => monthExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0),
    [monthExpenses],
  );

  const pendingDebts = useMemo(
    () => debtEntries.filter((entry) => entry.status === 'pending' && !entry.deleted),
    [debtEntries],
  );
  const openFiadoTotal = useMemo(
    () => clients.reduce((sum, client) => sum + getClientBalance(client.id), 0),
    [clients, getClientBalance],
  );

  const openDebtClients = useMemo<OpenDebtClient[]>(() => clients
    .map((client) => ({
      id: client.id,
      name: client.name,
      balance: getClientBalance(client.id),
      entries: pendingDebts.filter((entry) => entry.client_id === client.id),
    }))
    .filter((client) => client.balance > 0)
    .sort((left, right) => right.balance - left.balance), [clients, getClientBalance, pendingDebts]);

  const pendingAccounts = useMemo(
    () => accounts.filter((account) => account.status === 'pending'),
    [accounts],
  );
  const pendingAccountsTotal = useMemo(
    () => pendingAccounts.reduce((sum, account) => sum + Number(account.amount ?? 0), 0),
    [pendingAccounts],
  );

  const activePromotions = useMemo(() => {
    const currentDate = today();
    return promotions.filter((promotion) => (
      promotion.active
      && promotion.starts_at <= currentDate
      && (!promotion.ends_at || promotion.ends_at >= currentDate)
    ));
  }, [promotions]);

  const selectedPurchaseProduct = activeProducts.find((product) => product.id === purchaseForm.product_id);
  const selectedLabelProduct = activeProducts.find((product) => product.id === labelForm.product_id);
  const purchaseDraftSubtotal = purchaseDraftItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const supplierSummaries = useMemo(() => {
    const summaries = new Map<string, SupplierSummary>();

    const ensureSupplier = (name: string, record?: SupplierRecord) => {
      const normalizedName = name.trim();
      if (!normalizedName) return null;
      const key = normalizedName.toLocaleUpperCase('pt-BR');
      const current = summaries.get(key);
      if (current) {
        if (record) {
          current.id = record.id;
          current.whatsapp = record.whatsapp;
          current.registered = true;
          current.active = record.active;
        }
        return current;
      }

      const next = {
        id: record?.id ?? null,
        name: normalizedName,
        whatsapp: record?.whatsapp ?? '',
        registered: Boolean(record),
        active: record?.active ?? true,
        productsCount: 0,
        productNames: [],
        lowStockCount: 0,
        stockValue: 0,
        purchaseCount: 0,
        purchaseTotal: 0,
        lastPurchaseDate: null,
      };
      summaries.set(key, next);
      return next;
    };

    suppliers.filter((supplier) => supplier.active).forEach((supplier) => {
      ensureSupplier(supplier.name, supplier);
    });

    activeProducts.forEach((product) => {
      const supplierRecord = suppliers.find((record) => record.id === product.supplier_id);
      const supplier = ensureSupplier(supplierRecord?.name || product.supplier_name || '', supplierRecord);
      if (!supplier) return;
      supplier.productsCount += 1;
      supplier.productNames.push(product.name);
      supplier.stockValue += Number(product.stock ?? 0) * Number(product.cost_price ?? product.purchase_cost ?? 0);
      if (Number(product.min_stock ?? 0) > 0 && Number(product.stock ?? 0) <= Number(product.min_stock ?? 0)) {
        supplier.lowStockCount += 1;
      }
    });

    purchases.forEach((purchase) => {
      const supplierRecord = suppliers.find((record) => record.id === purchase.supplier_id);
      const supplier = ensureSupplier(supplierRecord?.name || purchase.supplier_name || '', supplierRecord);
      if (!supplier) return;
      supplier.purchaseCount += 1;
      supplier.purchaseTotal += Number(purchase.total_amount ?? 0);
      if (!supplier.lastPurchaseDate || purchase.purchase_date > supplier.lastPurchaseDate) {
        supplier.lastPurchaseDate = purchase.purchase_date;
      }
    });

    return Array.from(summaries.values()).sort((left, right) => right.purchaseTotal - left.purchaseTotal || left.name.localeCompare(right.name));
  }, [activeProducts, purchases, suppliers]);
  const visibleSupplierSummaries = useMemo(() => {
    const query = supplierSearch.trim().toLocaleUpperCase('pt-BR');
    if (!query) return supplierSummaries;
    return supplierSummaries.filter((supplier) => [supplier.name, supplier.whatsapp, ...supplier.productNames]
      .some((value) => value.toLocaleUpperCase('pt-BR').includes(query)));
  }, [supplierSearch, supplierSummaries]);
  const visiblePurchases = useMemo(() => {
    const query = purchaseSearch.trim().toLocaleUpperCase('pt-BR');
    return purchases
      .filter((purchase) => purchaseStatus === 'all' || purchase.status === purchaseStatus)
      .filter((purchase) => !query || [purchase.supplier_name, purchase.invoice_number]
        .some((value) => value?.toLocaleUpperCase('pt-BR').includes(query)))
      .sort((left, right) => {
        const leftPending = ['open', 'partially_received'].includes(left.status);
        const rightPending = ['open', 'partially_received'].includes(right.status);
        if (leftPending !== rightPending) return leftPending ? -1 : 1;
        return right.purchase_date.localeCompare(left.purchase_date);
      });
  }, [purchaseSearch, purchaseStatus, purchases]);

  const auditEvents = useMemo(() => {
    const canceledSales = sales
      .filter((sale) => sale.status === 'canceled')
      .slice(0, 8)
      .map((sale) => ({
        id: `sale-${sale.id}`,
        date: sale.date,
        title: 'Venda cancelada',
        detail: `${money(sale.total)}${sale.cancel_reason ? ` - ${sale.cancel_reason}` : ''}`,
      }));
    const stockAdjustments = stockMovements
      .filter((movement) => !['sale', 'purchase'].includes(String(movement.reason ?? '').toLowerCase()))
      .slice(0, 8)
      .map((movement) => ({
        id: `stock-${movement.id}`,
        date: movement.date,
        title: 'Movimento de estoque',
        detail: `${movement.type} ${movement.quantity} - ${movement.reason || 'Sem motivo'}`,
      }));
    const overdueAccounts = accounts
      .filter((account) => account.status === 'pending' && account.due_date < today())
      .slice(0, 8)
      .map((account) => ({
        id: `account-${account.id}`,
        date: account.due_date,
        title: account.account_type === 'payable' ? 'Conta vencida a pagar' : 'Conta vencida a receber',
        detail: `${account.description} - ${money(account.amount)}`,
      }));

    return [...overdueAccounts, ...canceledSales, ...stockAdjustments]
      .sort((left, right) => String(right.date).localeCompare(String(left.date)))
      .slice(0, 20);
  }, [accounts, sales, stockMovements]);

  const loadOperations = useCallback(async () => {
    if (!effectiveOwnerId) return;
    setLoading(true);

    const locationQuery = <T extends { eq: (column: string, value: string) => T }>(query: T) =>
      operationalLocationId ? query.eq('location_id', operationalLocationId) : query;

    const [purchaseResult, purchaseItemsResult, accountResult, promotionResult, batchResult, supplierResult] = await Promise.all([
      locationQuery(fromTable('purchase_orders').select('*').eq('owner_user_id', effectiveOwnerId)).order('purchase_date', { ascending: false }).limit(200),
      fromTable('purchase_order_items').select('*').eq('owner_user_id', effectiveOwnerId).order('created_at', { ascending: false }).limit(200),
      locationQuery(fromTable('financial_accounts').select('*').eq('owner_user_id', effectiveOwnerId)).order('due_date', { ascending: true }).limit(80),
      fromTable('product_promotions').select('*').eq('owner_user_id', effectiveOwnerId).order('created_at', { ascending: false }).limit(60),
      fromTable('product_batches').select('*').eq('owner_user_id', effectiveOwnerId).order('expiration_date', { ascending: true }).limit(80),
      fromTable('suppliers').select('*').eq('owner_user_id', effectiveOwnerId).order('name', { ascending: true }).limit(200),
    ]);

    setLoading(false);

    const error = purchaseResult.error || purchaseItemsResult.error || accountResult.error || promotionResult.error || batchResult.error;
    if (error) {
      console.error('Erro ao carregar operações:', getRedactedLogValue(error));
      toast.error('Não foi possível carregar os módulos operacionais.');
      return;
    }

    setPurchases(purchaseResult.data ?? []);
    setPurchaseItems(purchaseItemsResult.data ?? []);
    setAccounts(accountResult.data ?? []);
    setPromotions(promotionResult.data ?? []);
    setBatches(batchResult.data ?? []);
    if (supplierResult.error) {
      console.error('Erro ao carregar fornecedores:', getRedactedLogValue(supplierResult.error));
      setSuppliers([]);
    } else {
      setSuppliers(supplierResult.data ?? []);
    }
  }, [effectiveOwnerId, operationalLocationId]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  useEffect(() => {
    const requestedProductId = searchParams.get('product');
    if (!requestedProductId) return;
    const product = activeProducts.find((item) => item.id === requestedProductId);
    if (!product) return;

    const requestedSupplierName = searchParams.get('supplier')?.trim() || product.supplier_name || '';
    const supplier = suppliers.find((item) => item.active && item.name.toLocaleUpperCase('pt-BR') === requestedSupplierName.toLocaleUpperCase('pt-BR'));
    const quantity = Math.max(1, parseMoney(searchParams.get('quantity') || '1'));
    const unitCost = Number(product.purchase_cost ?? product.cost_price ?? 0);

    setActiveTab('compras');
    setPurchaseForm((current) => ({
      ...current,
      supplier_name: supplier?.name ?? requestedSupplierName,
      supplier_id: supplier?.id ?? '',
      due_date: dateAfterDays(Number(supplier?.payment_terms_days ?? 0)),
    }));
    setPurchaseDraftItems((current) => current.some((item) => item.productId === product.id)
      ? current
      : [...current, { productId: product.id, productName: product.name, quantity, unitCost }]);
    setSearchParams({}, { replace: true });
  }, [activeProducts, searchParams, setSearchParams, suppliers]);

  const resetPurchaseForm = () => {
    setPurchaseForm({
      supplier_name: '', supplier_id: '', invoice_number: '', purchase_date: today(),
      product_id: '', quantity: '', unit_cost: '', freight_amount: '', tax_amount: '',
      due_date: today(), create_payable: true, receive_stock: true, notes: '',
    });
    setPurchaseProductSearch('');
    setPurchaseDraftItems([]);
  };

  const addPurchaseDraftItem = () => {
    if (!selectedPurchaseProduct) {
      toast.error('Escolha um produto cadastrado.');
      return;
    }
    const quantity = parseMoney(purchaseForm.quantity);
    const unitCost = parseMoney(purchaseForm.unit_cost);
    if (quantity <= 0 || unitCost <= 0) {
      toast.error('Informe quantidade e custo unitário.');
      return;
    }

    setPurchaseDraftItems((current) => {
      const existing = current.find((item) => item.productId === selectedPurchaseProduct.id);
      if (existing) {
        return current.map((item) => item.productId === selectedPurchaseProduct.id
          ? { ...item, quantity: item.quantity + quantity, unitCost }
          : item);
      }
      return [...current, {
        productId: selectedPurchaseProduct.id,
        productName: selectedPurchaseProduct.name,
        quantity,
        unitCost,
      }];
    });
    setPurchaseProductSearch('');
    setPurchaseForm((current) => ({ ...current, product_id: '', quantity: '', unit_cost: '' }));
  };

  const receiveOrderItems = async (
    order: PurchaseOrder,
    receipts: Array<{ item_id: string; quantity: number }>,
    createPayable: boolean,
    dueDate: string,
  ) => {
    const { error } = await operationsRpc.rpc('receive_purchase_order', {
      p_order_id: order.id,
      p_receipts: receipts,
      p_create_payable: createPayable,
      p_due_date: dueDate,
    });
    if (error) throw error;
  };

  const savePurchase = async () => {
    if (!effectiveOwnerId) return;
    const supplier = suppliers.find((item) => item.id === purchaseForm.supplier_id && item.active);
    if (!supplier) {
      toast.error('Escolha um fornecedor cadastrado.');
      return;
    }
    if (purchaseDraftItems.length === 0) {
      toast.error('Adicione ao menos um produto à compra.');
      return;
    }

    const freight = parseMoney(purchaseForm.freight_amount);
    const tax = parseMoney(purchaseForm.tax_amount);
    const subtotal = purchaseDraftSubtotal;
    const total = subtotal + freight + tax;

    const { data: order, error: orderError } = await fromTable('purchase_orders')
      .insert({
        owner_user_id: effectiveOwnerId,
        location_id: operationalLocationId,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        invoice_number: purchaseForm.invoice_number.trim(),
        purchase_date: purchaseForm.purchase_date,
        due_date: purchaseForm.due_date,
        status: 'open',
        subtotal,
        freight_amount: freight,
        tax_amount: tax,
        total_amount: total,
        notes: purchaseForm.notes.trim(),
      })
      .select('*')
      .single();

    if (orderError) {
      console.error('Erro ao salvar compra:', getRedactedLogValue(orderError));
      toast.error('Não foi possível registrar a compra.');
      return;
    }

    const { data: itemRows, error: itemError } = await fromTable('purchase_order_items').insert(purchaseDraftItems.map((item) => ({
      owner_user_id: effectiveOwnerId,
      purchase_order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      total_cost: item.quantity * item.unitCost,
      received_quantity: 0,
    }))).select('*');

    if (itemError) {
      console.error('Erro ao salvar item da compra:', getRedactedLogValue(itemError));
      await fromTable('purchase_orders').delete().eq('id', order.id);
      toast.error('Não foi possível registrar os itens da compra.');
      return;
    }

    if (purchaseForm.receive_stock) {
      try {
        await receiveOrderItems(
          order as PurchaseOrder,
          (itemRows as PurchaseOrderItem[]).map((item) => ({ item_id: item.id, quantity: item.quantity })),
          purchaseForm.create_payable,
          purchaseForm.due_date,
        );
      } catch (error) {
        console.error('Erro ao receber compra:', getRedactedLogValue(error));
        toast.error('Pedido salvo, mas o estoque não foi recebido. Use a ação Receber.');
        resetPurchaseForm();
        await loadOperations();
        return;
      }
    } else if (purchaseForm.create_payable) {
      await fromTable('financial_accounts').insert({
        owner_user_id: effectiveOwnerId,
        location_id: operationalLocationId,
        account_type: 'payable',
        description: `Compra ${supplier.name}`,
        party_name: supplier.name,
        amount: total,
        due_date: purchaseForm.due_date,
        source: 'purchase',
        reference_id: order.id,
        notes: purchaseForm.invoice_number ? `NF ${purchaseForm.invoice_number}` : purchaseForm.notes.trim(),
      });
    }

    toast.success(purchaseForm.receive_stock ? 'Compra registrada e estoque recebido.' : 'Pedido de compra registrado.');
    resetPurchaseForm();
    await syncNow();
    await loadOperations();
  };

  const openPurchaseReceipt = (purchase: PurchaseOrder) => {
    const items = purchaseItems.filter((item) => item.purchase_order_id === purchase.id && item.received_quantity < item.quantity);
    setReceivingPurchase(purchase);
    setReceiveQuantities(Object.fromEntries(items.map((item) => [item.id, String(item.quantity - item.received_quantity)])));
    setReceiveCreatePayable(!accounts.some((account) => account.source === 'purchase' && account.reference_id === purchase.id));
    setReceiveDueDate(purchase.due_date || today());
  };

  const submitPurchaseReceipt = async () => {
    if (!receivingPurchase || receiving) return;
    const receipts = purchaseItems
      .filter((item) => item.purchase_order_id === receivingPurchase.id)
      .map((item) => ({ item_id: item.id, quantity: parseMoney(receiveQuantities[item.id] || '0') }))
      .filter((item) => item.quantity > 0);
    if (receipts.length === 0) {
      toast.error('Informe ao menos uma quantidade recebida.');
      return;
    }

    setReceiving(true);
    try {
      await receiveOrderItems(receivingPurchase, receipts, receiveCreatePayable, receiveDueDate);
      setReceivingPurchase(null);
      toast.success('Recebimento registrado e estoque atualizado.');
      await syncNow();
      await loadOperations();
    } catch (error) {
      console.error('Erro ao receber pedido:', getRedactedLogValue(error));
      toast.error('Não foi possível receber o pedido. Verifique as quantidades.');
    } finally {
      setReceiving(false);
    }
  };

  const saveSupplier = async () => {
    if (!effectiveOwnerId || !supplierForm.name.trim()) {
      toast.error('Informe o nome do fornecedor.');
      return;
    }

    const whatsapp = normalizePhone(supplierForm.whatsapp);
    if (whatsapp && whatsapp.length < 10) {
      toast.error('Informe um WhatsApp válido com DDD.');
      return;
    }
    const document = supplierForm.document.replace(/\D/g, '');
    if (document && ![11, 14].includes(document.length)) {
      toast.error('Informe um CPF ou CNPJ válido.');
      return;
    }
    const email = supplierForm.email.trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Informe um email válido.');
      return;
    }

    const payload = {
      owner_user_id: effectiveOwnerId,
      name: supplierForm.name.trim(),
      whatsapp,
      document,
      contact_name: supplierForm.contact_name.trim(),
      email,
      payment_terms_days: Math.max(0, Number.parseInt(supplierForm.payment_terms_days, 10) || 0),
      delivery_lead_days: Math.max(0, Number.parseInt(supplierForm.delivery_lead_days, 10) || 0),
      minimum_order: parseMoney(supplierForm.minimum_order),
      notes: supplierForm.notes.trim(),
      active: true,
    };
    const query = supplierForm.id
      ? fromTable('suppliers').update(payload).eq('id', supplierForm.id)
      : fromTable('suppliers').insert(payload);
    const { data: savedSupplier, error } = await query.select('*').single();

    if (error) {
      console.error('Erro ao salvar fornecedor:', getRedactedLogValue(error));
      toast.error('Não foi possível salvar o fornecedor. Verifique se o nome já está cadastrado.');
      return;
    }

    if (supplierForm.id) {
      await fromTable('products')
        .update({ supplier_name: payload.name })
        .eq('supplier_id', supplierForm.id)
        .eq('user_id', effectiveOwnerId);
    } else if (savedSupplier?.id) {
      await fromTable('products')
        .update({ supplier_id: savedSupplier.id, supplier_name: payload.name })
        .eq('user_id', effectiveOwnerId)
        .is('supplier_id', null)
        .ilike('supplier_name', payload.name);
    }

    toast.success('Fornecedor salvo.');
    setSupplierForm(createEmptySupplierForm());
    await syncNow();
    await loadOperations();
  };

  const toggleSupplierActive = async (supplier: SupplierRecord) => {
    const { error } = await fromTable('suppliers').update({ active: !supplier.active }).eq('id', supplier.id);
    if (error) {
      toast.error('Não foi possível alterar o status do fornecedor.');
      return;
    }
    toast.success(supplier.active ? 'Fornecedor inativado.' : 'Fornecedor reativado.');
    await loadOperations();
  };

  const openSupplierOrder = (supplierId = '') => {
    setSupplierOrderInitialId(supplierId);
    setSupplierOrderOpen(true);
  };

  const sendSupplierOrder = async (supplier: SupplierRecord, items: SupplierOrderItem[]) => {
    if (!effectiveOwnerId) return false;
    if (!supplier.whatsapp) {
      toast.error('Cadastre o WhatsApp do fornecedor antes de enviar o pedido.');
      return false;
    }

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const { data: order, error: orderError } = await fromTable('purchase_orders')
      .insert({
        owner_user_id: effectiveOwnerId,
        location_id: operationalLocationId,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        invoice_number: '',
        purchase_date: today(),
        status: 'open',
        subtotal,
        freight_amount: 0,
        tax_amount: 0,
        total_amount: subtotal,
        notes: 'Pedido de compra preparado para envio pelo WhatsApp.',
      })
      .select('*')
      .single();

    if (orderError || !order) {
      console.error('Erro ao criar pedido ao fornecedor:', getRedactedLogValue(orderError));
      toast.error('Não foi possível registrar o pedido.');
      return false;
    }

    const { error: itemError } = await fromTable('purchase_order_items').insert(items.map((item) => ({
      owner_user_id: effectiveOwnerId,
      purchase_order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_cost: item.unitCost,
      total_cost: item.quantity * item.unitCost,
    })));

    if (itemError) {
      console.error('Erro ao salvar itens do pedido:', getRedactedLogValue(itemError));
      toast.error('O pedido foi criado, mas os produtos não foram registrados.');
      return false;
    }

    const url = buildSupplierOrderWhatsAppUrl(supplier.whatsapp, supplier.name, items);
    if (!openExternalUrl(url)) {
      toast.error('Pedido salvo, mas não foi possível abrir o WhatsApp.');
      await loadOperations();
      return true;
    }

    toast.success('Pedido salvo e preparado no WhatsApp.');
    await loadOperations();
    return true;
  };

  const saveAccount = async () => {
    if (!effectiveOwnerId) return;
    const amount = parseMoney(accountForm.amount);
    if (!accountForm.description.trim() || !accountForm.party_name.trim() || amount <= 0) {
      toast.error('Informe descrição, fornecedor ou cliente e valor.');
      return;
    }

    const { error } = await fromTable('financial_accounts').insert({
      owner_user_id: effectiveOwnerId,
      location_id: operationalLocationId,
      account_type: accountForm.account_type,
      description: accountForm.description.trim(),
      party_name: accountForm.party_name.trim(),
      amount,
      due_date: accountForm.due_date,
      notes: accountForm.notes.trim(),
    });

    if (error) {
      console.error('Erro ao salvar conta:', getRedactedLogValue(error));
      toast.error('Não foi possível salvar a conta.');
      return;
    }

    toast.success('Conta registrada.');
    setAccountForm({ account_type: 'payable', description: '', party_name: '', amount: '', due_date: today(), notes: '' });
    await loadOperations();
  };

  const markAccountPaid = async (account: FinancialAccount) => {
    const { error } = await fromTable('financial_accounts')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', account.id);

    if (error) {
      toast.error('Não foi possível marcar como pago.');
      return;
    }

    toast.success('Conta marcada como paga.');
    await loadOperations();
  };

  const printLabels = () => {
    if (!selectedLabelProduct) {
      toast.error('Escolha um produto para imprimir etiqueta.');
      return;
    }

    const quantity = Math.max(1, Math.min(120, Number.parseInt(labelForm.quantity, 10) || 1));
    const labels = Array.from({ length: quantity }, () => selectedLabelProduct);
    const content = `
      <html>
        <head>
          <title>Etiquetas HappyCash</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 12px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .label { border: 1px dashed #222; border-radius: 6px; padding: 8px; min-height: 74px; display: flex; flex-direction: column; justify-content: center; }
            .name { font-size: 12px; font-weight: 700; }
            .price { font-size: 20px; font-weight: 800; margin-top: 4px; }
            .code { font-size: 10px; letter-spacing: 2px; margin-top: 6px; }
            @media print { body { margin: 0; } .label { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="grid">
            ${labels.map((product) => `
              <div class="label">
                <div class="name">${product.name}</div>
                <div class="price">${money(product.price)}</div>
                <div class="code">${product.barcode || formatProductCode(product.code) || product.id.slice(0, 8)}</div>
              </div>
            `).join('')}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow?.document.write(content);
    printWindow?.document.close();
  };

  const savePromotion = async () => {
    if (!effectiveOwnerId) return;
    const product = activeProducts.find((item) => item.id === promotionForm.product_id);
    const value = parseMoney(promotionForm.discount_value);
    if (!product || !promotionForm.title.trim() || value <= 0) {
      toast.error('Informe produto, nome da promoção e valor.');
      return;
    }

    const { error } = await fromTable('product_promotions').insert({
      owner_user_id: effectiveOwnerId,
      product_id: product.id,
      product_name: product.name,
      title: promotionForm.title.trim(),
      discount_type: promotionForm.discount_type,
      discount_value: value,
      starts_at: promotionForm.starts_at,
      ends_at: promotionForm.ends_at || null,
      notes: promotionForm.notes.trim(),
    });

    if (error) {
      toast.error('Não foi possível salvar a promoção.');
      return;
    }

    toast.success('Promoção cadastrada.');
    setPromotionForm({ product_id: '', title: '', discount_type: 'amount', discount_value: '', starts_at: today(), ends_at: '', notes: '' });
    await loadOperations();
  };

  const saveBatch = async () => {
    if (!effectiveOwnerId) return;
    const product = activeProducts.find((item) => item.id === batchForm.product_id);
    if (!product || !batchForm.expiration_date) {
      toast.error('Escolha produto e validade.');
      return;
    }

    const { error } = await fromTable('product_batches').insert({
      owner_user_id: effectiveOwnerId,
      product_id: product.id,
      product_name: product.name,
      batch_code: batchForm.batch_code.trim(),
      quantity: parseMoney(batchForm.quantity),
      expiration_date: batchForm.expiration_date,
      alert_days: Math.max(0, Number.parseInt(batchForm.alert_days, 10) || 30),
      notes: batchForm.notes.trim(),
    });

    if (error) {
      toast.error('Não foi possível salvar validade/lote.');
      return;
    }

    toast.success('Validade cadastrada.');
    setBatchForm({ product_id: '', batch_code: '', quantity: '', expiration_date: today(), alert_days: '30', notes: '' });
    setBatchProductSearch('');
    await loadOperations();
  };

  const removeBatch = async (adjustStock: boolean) => {
    if (!batchToRemove || removingBatch) return;

    setRemovingBatch(true);
    const { data, error } = await operationsRpc.rpc('discard_product_batch', {
      p_batch_id: batchToRemove.id,
      p_adjust_stock: adjustStock,
    });
    setRemovingBatch(false);

    if (error) {
      console.error('Erro ao dar baixa no lote:', getRedactedLogValue(error));
      toast.error(error.message || 'Não foi possível retirar o lote.');
      return;
    }

    const result = (data ?? {}) as { stock_quantity?: number };
    const adjustedQuantity = Number(result.stock_quantity ?? 0);
    if (adjustStock && adjustedQuantity > 0) {
      toast.success(`Lote retirado e ${adjustedQuantity} un. baixadas do estoque.`);
    } else if (adjustStock) {
      toast.success('Lote retirado. Não havia saldo disponível para baixar do estoque.');
    } else {
      toast.success('Controle de validade removido sem alterar o estoque.');
    }

    setBatchToRemove(null);
    await Promise.all([loadOperations(), syncNow()]);
  };

  const prepareSupplierOrder = (supplier: SupplierSummary) => {
    if (!supplier.id) {
      setSupplierForm(supplierFormFromRecord(undefined, supplier.name));
      toast.error('Complete o cadastro e o WhatsApp deste fornecedor antes de criar o pedido.');
      return;
    }
    if (!supplier.whatsapp) {
      const record = suppliers.find((item) => item.id === supplier.id);
      setSupplierForm(supplierFormFromRecord(record, supplier.name));
      toast.error('Cadastre o WhatsApp deste fornecedor antes de criar o pedido.');
      return;
    }
    openSupplierOrder(supplier.id);
  };

  if (dataLoading) {
    return <DataRouteLoader label="Carregando operacoes..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operações</h1>
          <p className="text-sm text-muted-foreground">
            Compras, contas, etiquetas, promoções, validade e sincronização em um só lugar.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadOperations()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <OperationsMetricCard label="Compras recentes" value={purchases.length} onClick={() => setDetail('purchases')} />
        <OperationsMetricCard label="Pendente financeiro" value={money(pendingAccountsTotal)} onClick={() => setDetail('accounts')} />
        <OperationsMetricCard label="Fornecedores ativos" value={supplierSummaries.filter((supplier) => supplier.active).length} onClick={() => setDetail('suppliers')} />
        <OperationsMetricCard label="Promoções ativas" value={activePromotions.length} onClick={() => setDetail('promotions')} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <OperationsMetricCard label="Vendas hoje" value={money(todayGrossTotal)} onClick={() => setDetail('sales')} />
        <OperationsMetricCard label="Lucro estimado hoje" value={money(todayProfitTotal)} onClick={() => setDetail('profit')} />
        <OperationsMetricCard label="Despesas do mês" value={money(monthExpensesTotal)} onClick={() => setDetail('expenses')} />
        <OperationsMetricCard label="Fiado em aberto" value={money(openFiadoTotal)} onClick={() => setDetail('debts')} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
          <TabsTrigger value="promocoes">Promoções</TabsTrigger>
          <TabsTrigger value="validade">Validade</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="fornecedores" className="grid min-w-0 gap-4 overflow-x-hidden xl:grid-cols-[minmax(250px,0.65fr)_minmax(0,1.35fr)]">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader><CardTitle>{supplierForm.id ? 'Editar fornecedor' : 'Cadastrar fornecedor'}</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Nome</Label><Input value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Distribuidora Central" /></div>
                <div className="space-y-1.5"><Label>CNPJ / CPF</Label><Input value={supplierForm.document} onChange={(event) => setSupplierForm((current) => ({ ...current, document: event.target.value.replace(/\D/g, '').slice(0, 14) }))} inputMode="numeric" /></div>
                <div className="space-y-1.5"><Label>Contato</Label><Input value={supplierForm.contact_name} onChange={(event) => setSupplierForm((current) => ({ ...current, contact_name: event.target.value }))} /></div>
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={supplierForm.whatsapp} onChange={(event) => setSupplierForm((current) => ({ ...current, whatsapp: event.target.value }))} inputMode="tel" placeholder="(11) 99999-9999" /></div>
              </div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>Prazo de pagamento</Label><Input type="number" min="0" value={supplierForm.payment_terms_days} onChange={(event) => setSupplierForm((current) => ({ ...current, payment_terms_days: event.target.value }))} /><p className="text-xs text-muted-foreground">dias</p></div>
                <div className="space-y-1.5"><Label>Prazo de entrega</Label><Input type="number" min="0" value={supplierForm.delivery_lead_days} onChange={(event) => setSupplierForm((current) => ({ ...current, delivery_lead_days: event.target.value }))} /><p className="text-xs text-muted-foreground">dias</p></div>
                <div className="space-y-1.5"><Label>Pedido mínimo</Label><Input inputMode="decimal" value={supplierForm.minimum_order} onChange={(event) => setSupplierForm((current) => ({ ...current, minimum_order: event.target.value }))} placeholder="R$ 0,00" /></div>
              </div>
              <div className="space-y-1.5"><Label>Observações</Label><Textarea value={supplierForm.notes} onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Contato, prazo ou condição comercial" /></div>
              <div className="flex gap-2">
                {supplierForm.id && <Button type="button" variant="outline" onClick={() => setSupplierForm(createEmptySupplierForm())}>Cancelar</Button>}
                <Button type="button" onClick={() => void saveSupplier()}>{supplierForm.id ? 'Salvar alterações' : 'Cadastrar'}</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 overflow-hidden">
            <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Fornecedores</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={supplierSearch} onChange={event => setSupplierSearch(event.target.value)} placeholder="Buscar fornecedor ou produto" />
              </div>
              {visibleSupplierSummaries.map((supplier) => (
                <div key={supplier.name} className="min-w-0 rounded-lg border bg-muted/10 p-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{supplier.name}</p>
                      {!supplier.active && <Badge variant="secondary" className="mt-1">Inativo</Badge>}
                      <p className="mt-1 break-words text-sm text-muted-foreground">WhatsApp: {supplier.whatsapp || 'Não cadastrado'}</p>
                      {suppliers.find((item) => item.id === supplier.id)?.contact_name && <p className="text-sm text-muted-foreground">Contato: {suppliers.find((item) => item.id === supplier.id)?.contact_name}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => {
                        const record = suppliers.find((item) => item.id === supplier.id);
                        setSupplierForm(supplierFormFromRecord(record, supplier.name));
                      }}><Edit className="mr-1 h-3.5 w-3.5" />Editar</Button>
                      {supplier.id && <Button type="button" size="sm" variant="outline" onClick={() => {
                        const record = suppliers.find((item) => item.id === supplier.id);
                        if (record) void toggleSupplierActive(record);
                      }}>{supplier.active ? 'Inativar' : 'Reativar'}</Button>}
                      {supplier.active && <Button type="button" size="sm" onClick={() => prepareSupplierOrder(supplier)}><MessageCircle className="mr-1 h-3.5 w-3.5" />Novo pedido</Button>}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
                    <div><p className="text-xs text-muted-foreground">Produtos</p><p className="font-semibold">{supplier.productsCount}</p></div>
                    <div><p className="text-xs text-muted-foreground">Estoque baixo</p><Badge variant={supplier.lowStockCount > 0 ? 'destructive' : 'outline'}>{supplier.lowStockCount}</Badge></div>
                    <div><p className="text-xs text-muted-foreground">Compras</p><p className="font-semibold">{supplier.purchaseCount}</p></div>
                    <div><p className="text-xs text-muted-foreground">Total comprado</p><p className="font-semibold">{money(supplier.purchaseTotal)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Última compra</p><p className="font-semibold">{formatDate(supplier.lastPurchaseDate)}</p></div>
                  </div>
                </div>
              ))}
              {visibleSupplierSummaries.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum fornecedor encontrado.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compras" className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" /> Registrar compra</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Fornecedor</Label>
                  <Input
                    list="purchase-suppliers"
                    value={purchaseForm.supplier_name}
                    onChange={(event) => {
                      const name = event.target.value;
                      const supplier = suppliers.find((item) => item.active && item.name.toLocaleUpperCase('pt-BR') === name.trim().toLocaleUpperCase('pt-BR'));
                      setPurchaseForm((current) => ({
                        ...current,
                        supplier_name: name,
                        supplier_id: supplier?.id ?? '',
                        due_date: supplier ? dateAfterDays(Number(supplier.payment_terms_days ?? 0)) : current.due_date,
                      }));
                    }}
                    placeholder="Digite ou escolha um fornecedor cadastrado"
                  />
                  <datalist id="purchase-suppliers">{suppliers.filter((supplier) => supplier.active).map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist>
                </div>
                <div className="space-y-1.5"><Label>NF / documento</Label><Input value={purchaseForm.invoice_number} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={purchaseForm.purchase_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={purchaseForm.due_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, due_date: e.target.value })} /></div>
              </div>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Produto</Label>
                  <Input
                    list="purchase-products"
                    value={purchaseProductSearch}
                    onChange={(event) => {
                      const value = event.target.value;
                      const query = value.trim().toLocaleUpperCase('pt-BR');
                      const exactProduct = activeProducts.find((product) => product.name.toLocaleUpperCase('pt-BR') === query || product.barcode.toLocaleUpperCase('pt-BR') === query);
                      const matchingProducts = activeProducts.filter((product) => product.name.toLocaleUpperCase('pt-BR').startsWith(query));
                      const identifiedProduct = exactProduct ?? (matchingProducts.length === 1 ? matchingProducts[0] : null);
                      setPurchaseProductSearch(value);
                      setPurchaseForm((current) => ({
                        ...current,
                        product_id: identifiedProduct?.id ?? '',
                        unit_cost: identifiedProduct ? String(identifiedProduct.purchase_cost ?? identifiedProduct.cost_price ?? 0) : current.unit_cost,
                      }));
                    }}
                    placeholder="Nome ou código de barras"
                  />
                  <datalist id="purchase-products">{activeProducts.map((product) => <option key={product.id} value={product.name} />)}</datalist>
                </div>
                <div className="grid gap-3 sm:grid-cols-[90px_120px_minmax(110px,1fr)] sm:items-end">
                  <div className="space-y-1.5"><Label>Qtd.</Label><Input inputMode="decimal" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Custo un.</Label><Input inputMode="decimal" value={purchaseForm.unit_cost} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_cost: e.target.value })} /></div>
                  <Button type="button" variant="outline" onClick={addPurchaseDraftItem} disabled={!selectedPurchaseProduct}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
                </div>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                {purchaseDraftItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-2 text-sm">
                    <div className="min-w-0"><p className="truncate font-medium">{item.productName}</p><p className="text-xs text-muted-foreground">{item.quantity} × {money(item.unitCost)} = {money(item.quantity * item.unitCost)}</p></div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setPurchaseDraftItems((current) => current.filter((currentItem) => currentItem.productId !== item.productId))} aria-label={`Remover ${item.productName}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {purchaseDraftItems.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Adicione os produtos desta compra.</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>Frete total</Label><Input inputMode="decimal" value={purchaseForm.freight_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, freight_amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Imposto total</Label><Input inputMode="decimal" value={purchaseForm.tax_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, tax_amount: e.target.value })} /></div>
                <div className="rounded-md border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Total da compra</p><p className="font-semibold">{money(purchaseDraftSubtotal + parseMoney(purchaseForm.freight_amount) + parseMoney(purchaseForm.tax_amount))}</p></div>
              </div>
              {purchaseForm.supplier_id && Number(suppliers.find((item) => item.id === purchaseForm.supplier_id)?.minimum_order ?? 0) > purchaseDraftSubtotal && (
                <p className="text-sm text-amber-600">O pedido está abaixo do mínimo de {money(suppliers.find((item) => item.id === purchaseForm.supplier_id)?.minimum_order)} deste fornecedor.</p>
              )}
              <Textarea value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} placeholder="Observações da compra" />
              <div className="flex flex-wrap gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={purchaseForm.receive_stock} onChange={(e) => setPurchaseForm({ ...purchaseForm, receive_stock: e.target.checked })} /> Receber estoque agora</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={purchaseForm.create_payable} onChange={(e) => setPurchaseForm({ ...purchaseForm, create_payable: e.target.checked })} /> Gerar conta a pagar</label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void savePurchase()} className="gap-2" disabled={purchaseDraftItems.length === 0}><Plus className="h-4 w-4" /> Salvar compra</Button>
                <Button type="button" variant="outline" onClick={() => {
                  const supplier = suppliers.find((item) => item.active && item.id === purchaseForm.supplier_id)
                    ?? suppliers.find((item) => item.active && item.name.toLocaleUpperCase('pt-BR') === purchaseForm.supplier_name.trim().toLocaleUpperCase('pt-BR'));
                  if (!supplier) {
                    toast.error('Escolha um fornecedor cadastrado para enviar o pedido.');
                    return;
                  }
                  openSupplierOrder(supplier.id);
                }}><MessageCircle className="mr-2 h-4 w-4" />Enviar pedido</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Últimas compras</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_190px]">
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={purchaseSearch} onChange={event => setPurchaseSearch(event.target.value)} placeholder="Fornecedor ou NF" /></div>
                <Select value={purchaseStatus} onValueChange={setPurchaseStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="open">Abertos</SelectItem><SelectItem value="partially_received">Parciais</SelectItem><SelectItem value="received">Recebidos</SelectItem><SelectItem value="canceled">Cancelados</SelectItem></SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Fornecedor</TableHead><TableHead>Itens</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>{visiblePurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
                    <TableCell>{purchase.supplier_name || '-'}</TableCell>
                    <TableCell>{purchaseItems.filter((item) => item.purchase_order_id === purchase.id).length}</TableCell>
                    <TableCell>{money(purchase.total_amount)}</TableCell>
                    <TableCell><Badge variant="outline">{purchaseStatusLabel(purchase.status)}</Badge></TableCell>
                    <TableCell>{['open', 'partially_received'].includes(purchase.status) && <Button type="button" size="sm" variant="outline" onClick={() => openPurchaseReceipt(purchase)}><PackageCheck className="mr-1 h-4 w-4" />Receber</Button>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contas" className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Nova conta</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Select value={accountForm.account_type} onValueChange={(value: 'payable' | 'receivable') => setAccountForm({ ...accountForm, account_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="payable">Conta a pagar</SelectItem><SelectItem value="receivable">Conta a receber</SelectItem></SelectContent>
              </Select>
              <Input placeholder="Descrição" value={accountForm.description} onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })} />
              <Input placeholder="Fornecedor ou cliente" value={accountForm.party_name} onChange={(e) => setAccountForm({ ...accountForm, party_name: e.target.value })} list="known-parties" />
              <datalist id="known-parties">{clients.map((client) => <option key={client.id} value={client.name} />)}</datalist>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input inputMode="decimal" placeholder="Valor" value={accountForm.amount} onChange={(e) => setAccountForm({ ...accountForm, amount: e.target.value })} />
                <Input type="date" value={accountForm.due_date} onChange={(e) => setAccountForm({ ...accountForm, due_date: e.target.value })} />
              </div>
              <Textarea placeholder="Observações" value={accountForm.notes} onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })} />
              <Button onClick={() => void saveAccount()}>Salvar conta</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Agenda financeira</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Vence</TableHead><TableHead>Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>{accounts.map((account) => (
                  <TableRow key={account.id} className={account.status === 'paid' ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : undefined}>
                    <TableCell>{account.status === 'paid' ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Pago</Badge> : <Badge variant={account.account_type === 'payable' ? 'destructive' : 'secondary'}>{account.account_type === 'payable' ? 'Pagar' : 'Receber'}</Badge>}</TableCell>
                    <TableCell><p className="font-medium">{account.description}</p><p className="text-xs text-muted-foreground">{account.party_name}</p></TableCell>
                    <TableCell>{formatDate(account.due_date)}</TableCell>
                    <TableCell>{money(account.amount)}</TableCell>
                    <TableCell>{account.status === 'pending' ? <Button size="sm" variant="outline" onClick={() => void markAccountPaid(account)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Marcar como pago</Button> : <span className="font-medium text-emerald-600">Pagamento concluído</span>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="etiquetas" className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Barcode className="h-5 w-5" /> Etiquetas</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Produto</Label>
                <Input
                  list="label-products"
                  value={labelProductSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    const query = value.trim().toLocaleUpperCase('pt-BR');
                    const exactProduct = activeProducts.find((product) => product.name.toLocaleUpperCase('pt-BR') === query);
                    const matchingProducts = activeProducts.filter((product) => product.name.toLocaleUpperCase('pt-BR').startsWith(query));
                    const identifiedProduct = exactProduct ?? (matchingProducts.length === 1 ? matchingProducts[0] : null);
                    setLabelProductSearch(value);
                    setLabelForm((current) => ({ ...current, product_id: identifiedProduct?.id ?? '' }));
                  }}
                  placeholder="Digite o nome do produto"
                />
                <datalist id="label-products">{activeProducts.map((product) => <option key={product.id} value={product.name} />)}</datalist>
                <p className="text-xs text-muted-foreground">{selectedLabelProduct ? `Produto identificado: ${selectedLabelProduct.name}` : 'Digite até identificar um produto cadastrado.'}</p>
              </div>
              <div className="space-y-1.5"><Label>Quantidade de etiquetas</Label><Input type="number" min="1" max="120" value={labelForm.quantity} onChange={(e) => setLabelForm({ ...labelForm, quantity: e.target.value })} /></div>
              <Button onClick={printLabels} className="gap-2"><FileDown className="h-4 w-4" /> Imprimir etiquetas</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Prévia</CardTitle></CardHeader>
            <CardContent>
              <div className="max-w-xs rounded-md border border-dashed p-4">
                <p className="text-sm font-semibold">{selectedLabelProduct?.name || 'Produto'}</p>
                <p className="mt-1 text-2xl font-black">{money(selectedLabelProduct?.price ?? 0)}</p>
                <p className="mt-2 text-xs tracking-[0.2em] text-muted-foreground">{selectedLabelProduct?.barcode || 'CODIGO'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promocoes" className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Nova promoção</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Select value={promotionForm.product_id} onValueChange={(value) => setPromotionForm({ ...promotionForm, product_id: value })}>
                <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>{activeProducts.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Nome da promoção" value={promotionForm.title} onChange={(e) => setPromotionForm({ ...promotionForm, title: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={promotionForm.discount_type} onValueChange={(value: 'amount' | 'percent' | 'fixed_price') => setPromotionForm({ ...promotionForm, discount_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="amount">Desconto em R$</SelectItem><SelectItem value="percent">Desconto em %</SelectItem><SelectItem value="fixed_price">Preço fixo</SelectItem></SelectContent>
                </Select>
                <Input inputMode="decimal" placeholder="Valor" value={promotionForm.discount_value} onChange={(e) => setPromotionForm({ ...promotionForm, discount_value: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="date" value={promotionForm.starts_at} onChange={(e) => setPromotionForm({ ...promotionForm, starts_at: e.target.value })} />
                <Input type="date" value={promotionForm.ends_at} onChange={(e) => setPromotionForm({ ...promotionForm, ends_at: e.target.value })} />
              </div>
              <Textarea placeholder="Observações" value={promotionForm.notes} onChange={(e) => setPromotionForm({ ...promotionForm, notes: e.target.value })} />
              <Button onClick={() => void savePromotion()}>Salvar promoção</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Promoções cadastradas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {promotions.map((promotion) => (
                <div key={promotion.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-medium">{promotion.title}</p><p className="text-sm text-muted-foreground">{promotion.product_name}</p></div>
                    <Badge variant={promotion.active ? 'default' : 'outline'}>{promotion.active ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                  <p className="mt-2 text-sm">Valor: {promotion.discount_type === 'percent' ? `${promotion.discount_value}%` : money(promotion.discount_value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validade" className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Validade e lote</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="batch-product-search">Produto cadastrado</Label>
                <Input
                  id="batch-product-search"
                  value={batchProductSearch}
                  onChange={(event) => {
                    setBatchProductSearch(toProductUppercase(event.target.value));
                    setBatchForm((current) => ({ ...current, product_id: '' }));
                  }}
                  placeholder="Nome, código ou código de barras"
                />
                {batchProductResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {batchProductResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                        onClick={() => {
                          setBatchForm((current) => ({ ...current, product_id: product.id }));
                          setBatchProductSearch(product.name);
                        }}
                      >
                        <span className="min-w-0 truncate">{product.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatProductCode(product.code) || product.barcode || 'Sem código'} · saldo {product.stock}</span>
                      </button>
                    ))}
                  </div>
                )}
                {batchProductSearch.trim() && !selectedBatchProduct && batchProductResults.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum produto encontrado.</p>
                )}
                {selectedBatchProduct && (
                  <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{selectedBatchProduct.name}</p>
                      <p className="text-xs text-muted-foreground">{formatProductCode(selectedBatchProduct.code) || selectedBatchProduct.barcode || 'Sem código'} · estoque atual {selectedBatchProduct.stock}</p>
                    </div>
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Lote" value={batchForm.batch_code} onChange={(e) => setBatchForm({ ...batchForm, batch_code: e.target.value })} />
                <Input inputMode="decimal" placeholder="Quantidade" value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} />
                <Input type="date" value={batchForm.expiration_date} onChange={(e) => setBatchForm({ ...batchForm, expiration_date: e.target.value })} />
                <Input type="number" min="0" value={batchForm.alert_days} onChange={(e) => setBatchForm({ ...batchForm, alert_days: e.target.value })} />
              </div>
              <Textarea placeholder="Observações" value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} />
              <Button onClick={() => void saveBatch()}>Salvar validade</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Lotes monitorados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead>Qtd.</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                <TableBody>{batches.map((batch) => {
                  const remaining = daysUntil(batch.expiration_date);
                  const product = batch.product_id ? products.find((item) => item.id === batch.product_id) : null;
                  return (
                    <TableRow key={batch.id}>
                      <TableCell><p className="font-medium">{product?.name || batch.product_name}</p><p className="text-xs text-muted-foreground">{product ? formatProductCode(product.code) || product.barcode || 'Sem código' : 'Cadastro não localizado'}</p></TableCell><TableCell>{batch.batch_code || '-'}</TableCell><TableCell>{formatDate(batch.expiration_date)}</TableCell><TableCell>{batch.quantity}</TableCell>
                      <TableCell><Badge variant={remaining < 0 ? 'destructive' : remaining <= batch.alert_days ? 'secondary' : 'outline'}>{remaining < 0 ? 'Vencido' : `${remaining} dias`}</Badge></TableCell>
                      <TableCell className="text-right"><Button type="button" size="sm" variant={remaining < 0 ? 'destructive' : 'outline'} onClick={() => setBatchToRemove(batch)}><Trash2 className="mr-1 h-4 w-4" />{remaining < 0 ? 'Dar baixa' : 'Remover'}</Button></TableCell>
                    </TableRow>
                  );
                })}
                {batches.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum lote monitorado.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={Boolean(batchToRemove)} onOpenChange={(open) => { if (!open && !removingBatch) setBatchToRemove(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{batchToRemove && daysUntil(batchToRemove.expiration_date) < 0 ? 'Dar baixa no lote vencido?' : 'Remover este lote?'}</DialogTitle>
              <DialogDescription>Escolha se a retirada também deve diminuir o estoque físico.</DialogDescription>
            </DialogHeader>
            {batchToRemove && (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="font-medium">{batchToRemoveProduct?.name || batchToRemove.product_name}</p>
                  <p className="text-xs text-muted-foreground">{batchToRemoveProduct ? formatProductCode(batchToRemoveProduct.code) || batchToRemoveProduct.barcode || 'Sem código' : 'Cadastro não localizado'}</p>
                  <p className="text-muted-foreground">Lote {batchToRemove.batch_code || 'não informado'} · validade {formatDate(batchToRemove.expiration_date)} · {batchToRemove.quantity} un.</p>
                </div>
                <p><strong>Dar baixa do estoque</strong> registra uma saída por vencimento e remove somente este lote. O cadastro do produto e os outros lotes continuam ativos.</p>
                <p className="text-muted-foreground"><strong>Só remover o controle</strong> apaga apenas esta validade, sem mudar o saldo do estoque. Use para um lote cadastrado por engano.</p>
              </div>
            )}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" disabled={removingBatch} onClick={() => setBatchToRemove(null)}>Cancelar</Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" disabled={removingBatch} onClick={() => void removeBatch(false)}>Só remover o controle</Button>
                <Button type="button" variant="destructive" disabled={removingBatch} onClick={() => void removeBatch(true)}>{removingBatch && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Dar baixa do estoque</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent value="backup">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" /> Backup e sincronização</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Status local</AlertTitle>
                <AlertDescription>
                  Preparação offline: {offlinePreparationStatus}. {offlinePreparationMessage || 'Sem mensagem adicional.'}
                </AlertDescription>
              </Alert>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Última cópia offline</p><p className="font-semibold">{offlineSnapshotUpdatedAt ? new Date(offlineSnapshotUpdatedAt).toLocaleString('pt-BR') : 'Ainda não preparada'}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Produtos carregados</p><p className="font-semibold">{products.length}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Clientes carregados</p><p className="font-semibold">{clients.length}</p></div>
              </div>
              <Button onClick={() => void handleManualSync()} className="gap-2" disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Auditoria comercial</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Evento</TableHead><TableHead>Detalhe</TableHead></TableRow></TableHeader>
                <TableBody>
                  {auditEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDate(event.date)}</TableCell>
                      <TableCell>{event.title}</TableCell>
                      <TableCell>{event.detail}</TableCell>
                    </TableRow>
                  ))}
                  {auditEvents.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">Nenhum evento crítico recente.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(receivingPurchase)} onOpenChange={(nextOpen) => { if (!nextOpen && !receiving) setReceivingPurchase(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Receber pedido de compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{receivingPurchase?.supplier_name}</p>
              <p className="text-muted-foreground">Pedido de {formatDate(receivingPurchase?.purchase_date)} · {money(receivingPurchase?.total_amount)}</p>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {purchaseItems.filter((item) => item.purchase_order_id === receivingPurchase?.id && item.received_quantity < item.quantity).map((item) => {
                const remaining = item.quantity - item.received_quantity;
                return (
                  <div key={item.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_130px] sm:items-center">
                    <div><p className="font-medium">{item.product_name}</p><p className="text-xs text-muted-foreground">Pedido: {item.quantity} · já recebido: {item.received_quantity} · pendente: {remaining}</p></div>
                    <div className="space-y-1"><Label>Receber agora</Label><Input type="number" min="0" max={remaining} step="0.001" value={receiveQuantities[item.id] ?? ''} onChange={event => setReceiveQuantities((current) => ({ ...current, [item.id]: event.target.value }))} /></div>
                  </div>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={receiveCreatePayable} onChange={event => setReceiveCreatePayable(event.target.checked)} /> Gerar conta a pagar se ainda não existir</label>
            {receiveCreatePayable && <div className="space-y-1.5"><Label>Vencimento da conta</Label><Input type="date" value={receiveDueDate} onChange={event => setReceiveDueDate(event.target.value)} /></div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReceivingPurchase(null)} disabled={receiving}>Cancelar</Button>
            <Button type="button" onClick={() => void submitPurchaseReceipt()} disabled={receiving}>{receiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}{receiving ? 'Recebendo...' : 'Confirmar recebimento'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail !== null && (
        <Suspense fallback={null}>
          <OperationsDetailsDialog
            detail={detail}
            onOpenChange={(open) => { if (!open) setDetail(null); }}
            purchases={purchases}
            purchaseItems={purchaseItems}
            pendingAccounts={pendingAccounts}
            suppliers={supplierSummaries}
            activePromotions={activePromotions}
            todaySales={todaySales}
            todaySaleItems={todaySaleItems}
            monthExpenses={monthExpenses}
            openDebtClients={openDebtClients}
            expiringBatches={expiringBatches}
            products={products}
            clients={clients}
          />
        </Suspense>
      )}
      {supplierOrderOpen && (
        <Suspense fallback={null}>
          <SupplierOrderDialog
            open={supplierOrderOpen}
            initialSupplierId={supplierOrderInitialId}
            suppliers={suppliers.filter((supplier) => supplier.active)}
            products={activeProducts}
            onOpenChange={setSupplierOrderOpen}
            onSend={sendSupplierOrder}
          />
        </Suspense>
      )}
    </div>
  );
}
