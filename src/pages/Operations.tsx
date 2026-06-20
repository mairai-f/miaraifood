import { useCallback, useEffect, useMemo, useState } from 'react';
import { Barcode, Boxes, CalendarClock, CheckCircle2, Edit, FileDown, Loader2, MessageCircle, PackagePlus, Percent, Plus, RefreshCw, ShieldCheck, Truck, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { OperationsDetailsDialog } from '@/components/operations/OperationsDetailsDialog';
import { OperationsMetricCard } from '@/components/operations/OperationsMetricCard';
import { SupplierOrderDialog, type SupplierOrderItem } from '@/components/operations/SupplierOrderDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { parseDecimalInput } from '@/lib/numberInput';
import { normalizePhone } from '@/lib/phone';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { buildSupplierOrderWhatsAppUrl } from '@/lib/whatsapp';
import type { FinancialAccount, OpenDebtClient, OperationsDetail, ProductBatch, ProductPromotion, PurchaseOrder, PurchaseOrderItem, SupplierRecord, SupplierSummary } from '@/types/operations';
import { getRedactedLogValue } from '../../shared/security/redaction';

const fromTable = (table: string) => supabase.from(table as never);
const today = () => new Date().toISOString().slice(0, 10);
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

export default function Operations() {
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
    updateProduct,
    addStockMovement,
    offlinePreparationStatus,
    offlinePreparationMessage,
    offlineSnapshotUpdatedAt,
    refetch,
  } = useData();
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
  const [supplierForm, setSupplierForm] = useState({ id: '', name: '', whatsapp: '', notes: '' });

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
        }
        return current;
      }

      const next = {
        id: record?.id ?? null,
        name: normalizedName,
        whatsapp: record?.whatsapp ?? '',
        registered: Boolean(record),
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
      const supplier = ensureSupplier(product.supplier_name || '');
      if (!supplier) return;
      supplier.productsCount += 1;
      supplier.productNames.push(product.name);
      supplier.stockValue += Number(product.stock ?? 0) * Number(product.cost_price ?? product.purchase_cost ?? 0);
      if (Number(product.min_stock ?? 0) > 0 && Number(product.stock ?? 0) <= Number(product.min_stock ?? 0)) {
        supplier.lowStockCount += 1;
      }
    });

    purchases.forEach((purchase) => {
      const supplier = ensureSupplier(purchase.supplier_name || '');
      if (!supplier) return;
      supplier.purchaseCount += 1;
      supplier.purchaseTotal += Number(purchase.total_amount ?? 0);
      if (!supplier.lastPurchaseDate || purchase.purchase_date > supplier.lastPurchaseDate) {
        supplier.lastPurchaseDate = purchase.purchase_date;
      }
    });

    return Array.from(summaries.values()).sort((left, right) => right.purchaseTotal - left.purchaseTotal || left.name.localeCompare(right.name));
  }, [activeProducts, purchases, suppliers]);

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

    const [purchaseResult, purchaseItemsResult, accountResult, promotionResult, batchResult, supplierResult] = await Promise.all([
      fromTable('purchase_orders').select('*').eq('owner_user_id', effectiveOwnerId).order('purchase_date', { ascending: false }).limit(20),
      fromTable('purchase_order_items').select('*').eq('owner_user_id', effectiveOwnerId).order('created_at', { ascending: false }).limit(200),
      fromTable('financial_accounts').select('*').eq('owner_user_id', effectiveOwnerId).order('due_date', { ascending: true }).limit(80),
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
  }, [effectiveOwnerId]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  const savePurchase = async () => {
    if (!effectiveOwnerId) return;
    if (!purchaseForm.supplier_name.trim()) {
      toast.error('Informe o fornecedor da compra.');
      return;
    }
    if (!selectedPurchaseProduct) {
      toast.error('Escolha o produto comprado.');
      return;
    }

    const quantity = parseMoney(purchaseForm.quantity);
    const unitCost = parseMoney(purchaseForm.unit_cost);
    const freight = parseMoney(purchaseForm.freight_amount);
    const tax = parseMoney(purchaseForm.tax_amount);
    const subtotal = quantity * unitCost;
    const total = subtotal + freight + tax;

    if (quantity <= 0 || unitCost <= 0) {
      toast.error('Informe quantidade e custo unitário.');
      return;
    }

    const { data: order, error: orderError } = await fromTable('purchase_orders')
      .insert({
        owner_user_id: effectiveOwnerId,
        supplier_id: purchaseForm.supplier_id || null,
        supplier_name: purchaseForm.supplier_name.trim(),
        invoice_number: purchaseForm.invoice_number.trim(),
        purchase_date: purchaseForm.purchase_date,
        status: purchaseForm.receive_stock ? 'received' : 'open',
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

    const { error: itemError } = await fromTable('purchase_order_items').insert({
      owner_user_id: effectiveOwnerId,
      purchase_order_id: order.id,
      product_id: selectedPurchaseProduct.id,
      product_name: selectedPurchaseProduct.name,
      quantity,
      unit_cost: unitCost,
      total_cost: subtotal,
    });

    if (itemError) {
      console.error('Erro ao salvar item da compra:', getRedactedLogValue(itemError));
      toast.error('Compra criada, mas o item não foi registrado.');
    }

    if (purchaseForm.create_payable) {
      await fromTable('financial_accounts').insert({
        owner_user_id: effectiveOwnerId,
        account_type: 'payable',
        description: `Compra ${selectedPurchaseProduct.name}`,
        party_name: purchaseForm.supplier_name.trim(),
        amount: total,
        due_date: purchaseForm.due_date,
        source: 'purchase',
        notes: purchaseForm.invoice_number ? `NF ${purchaseForm.invoice_number}` : purchaseForm.notes.trim(),
      });
    }

    if (purchaseForm.receive_stock) {
      const unitFreight = quantity > 0 ? freight / quantity : 0;
      const unitTax = quantity > 0 ? tax / quantity : 0;

      await updateProduct(selectedPurchaseProduct.id, {
        purchase_cost: unitCost,
        freight_cost: unitFreight,
        tax_cost: unitTax,
        supplier_name: purchaseForm.supplier_name.trim(),
      });
      await addStockMovement(
        selectedPurchaseProduct.id,
        'entrada',
        quantity,
        `Compra${purchaseForm.supplier_name.trim() ? ` - ${purchaseForm.supplier_name.trim()}` : ''}${purchaseForm.invoice_number.trim() ? ` NF ${purchaseForm.invoice_number.trim()}` : ''}`,
      );
    }

    toast.success('Compra registrada.');
    setPurchaseForm({
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
    setPurchaseProductSearch('');
    await loadOperations();
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

    const payload = {
      owner_user_id: effectiveOwnerId,
      name: supplierForm.name.trim(),
      whatsapp,
      notes: supplierForm.notes.trim(),
      active: true,
    };
    const query = supplierForm.id
      ? fromTable('suppliers').update(payload).eq('id', supplierForm.id)
      : fromTable('suppliers').insert(payload);
    const { error } = await query;

    if (error) {
      console.error('Erro ao salvar fornecedor:', getRedactedLogValue(error));
      toast.error('Não foi possível salvar o fornecedor. Verifique se o nome já está cadastrado.');
      return;
    }

    toast.success('Fornecedor salvo.');
    setSupplierForm({ id: '', name: '', whatsapp: '', notes: '' });
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
                <div class="code">${product.barcode || product.code || product.id.slice(0, 8)}</div>
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

  const prepareSupplierOrder = (supplier: SupplierSummary) => {
    if (!supplier.id) {
      setSupplierForm({ id: '', name: supplier.name, whatsapp: '', notes: '' });
      toast.error('Complete o cadastro e o WhatsApp deste fornecedor antes de criar o pedido.');
      return;
    }
    if (!supplier.whatsapp) {
      const record = suppliers.find((item) => item.id === supplier.id);
      setSupplierForm({ id: supplier.id, name: supplier.name, whatsapp: '', notes: record?.notes ?? '' });
      toast.error('Cadastre o WhatsApp deste fornecedor antes de criar o pedido.');
      return;
    }
    openSupplierOrder(supplier.id);
  };

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
        <OperationsMetricCard label="Fornecedores ativos" value={supplierSummaries.length} onClick={() => setDetail('suppliers')} />
        <OperationsMetricCard label="Promoções ativas" value={activePromotions.length} onClick={() => setDetail('promotions')} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <OperationsMetricCard label="Vendas hoje" value={money(todayGrossTotal)} onClick={() => setDetail('sales')} />
        <OperationsMetricCard label="Lucro estimado hoje" value={money(todayProfitTotal)} onClick={() => setDetail('profit')} />
        <OperationsMetricCard label="Despesas do mês" value={money(monthExpensesTotal)} onClick={() => setDetail('expenses')} />
        <OperationsMetricCard label="Fiado em aberto" value={money(openFiadoTotal)} onClick={() => setDetail('debts')} />
      </div>

      <Tabs defaultValue="compras" className="space-y-4">
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
              <div className="space-y-1.5"><Label>Nome</Label><Input value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex: Distribuidora Central" /></div>
              <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={supplierForm.whatsapp} onChange={(event) => setSupplierForm((current) => ({ ...current, whatsapp: event.target.value }))} inputMode="tel" placeholder="(11) 99999-9999" /></div>
              <div className="space-y-1.5"><Label>Observações</Label><Textarea value={supplierForm.notes} onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Contato, prazo ou condição comercial" /></div>
              <div className="flex gap-2">
                {supplierForm.id && <Button type="button" variant="outline" onClick={() => setSupplierForm({ id: '', name: '', whatsapp: '', notes: '' })}>Cancelar</Button>}
                <Button type="button" onClick={() => void saveSupplier()}>{supplierForm.id ? 'Salvar alterações' : 'Cadastrar'}</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="min-w-0 overflow-hidden">
            <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Fornecedores</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {supplierSummaries.map((supplier) => (
                <div key={supplier.name} className="min-w-0 rounded-lg border bg-muted/10 p-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{supplier.name}</p>
                      <p className="mt-1 break-words text-sm text-muted-foreground">WhatsApp: {supplier.whatsapp || 'Não cadastrado'}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => {
                        const record = suppliers.find((item) => item.id === supplier.id);
                        setSupplierForm({ id: supplier.id ?? '', name: supplier.name, whatsapp: supplier.whatsapp, notes: record?.notes ?? '' });
                      }}><Edit className="mr-1 h-3.5 w-3.5" />Editar</Button>
                      <Button type="button" size="sm" onClick={() => prepareSupplierOrder(supplier)}><MessageCircle className="mr-1 h-3.5 w-3.5" />Novo pedido</Button>
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
              {supplierSummaries.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum fornecedor encontrado em produtos ou compras.</p>}
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
                      const supplier = suppliers.find((item) => item.name.toLocaleUpperCase('pt-BR') === name.trim().toLocaleUpperCase('pt-BR'));
                      setPurchaseForm((current) => ({ ...current, supplier_name: name, supplier_id: supplier?.id ?? '' }));
                    }}
                    placeholder="Digite ou escolha um fornecedor cadastrado"
                  />
                  <datalist id="purchase-suppliers">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist>
                </div>
                <div className="space-y-1.5"><Label>NF / documento</Label><Input value={purchaseForm.invoice_number} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={purchaseForm.purchase_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={purchaseForm.due_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, due_date: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Produto</Label>
                <Input
                  list="purchase-products"
                  value={purchaseProductSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    const query = value.trim().toLocaleUpperCase('pt-BR');
                    const exactProduct = activeProducts.find((product) => product.name.toLocaleUpperCase('pt-BR') === query);
                    const matchingProducts = activeProducts.filter((product) => product.name.toLocaleUpperCase('pt-BR').startsWith(query));
                    const identifiedProduct = exactProduct ?? (matchingProducts.length === 1 ? matchingProducts[0] : null);
                    setPurchaseProductSearch(value);
                    setPurchaseForm((current) => ({ ...current, product_id: identifiedProduct?.id ?? '' }));
                  }}
                  placeholder="Digite o nome do produto"
                />
                <datalist id="purchase-products">{activeProducts.map((product) => <option key={product.id} value={product.name} />)}</datalist>
                <p className="text-xs text-muted-foreground">{selectedPurchaseProduct ? `Produto identificado: ${selectedPurchaseProduct.name}` : 'Digite até identificar um produto cadastrado.'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5"><Label>Qtd.</Label><Input inputMode="decimal" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Custo un.</Label><Input inputMode="decimal" value={purchaseForm.unit_cost} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_cost: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Frete</Label><Input inputMode="decimal" value={purchaseForm.freight_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, freight_amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Imposto</Label><Input inputMode="decimal" value={purchaseForm.tax_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, tax_amount: e.target.value })} /></div>
              </div>
              <Textarea value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} placeholder="Observações da compra" />
              <div className="flex flex-wrap gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={purchaseForm.receive_stock} onChange={(e) => setPurchaseForm({ ...purchaseForm, receive_stock: e.target.checked })} /> Entrar no estoque</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={purchaseForm.create_payable} onChange={(e) => setPurchaseForm({ ...purchaseForm, create_payable: e.target.checked })} /> Gerar conta a pagar</label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void savePurchase()} className="gap-2"><Plus className="h-4 w-4" /> Salvar compra</Button>
                <Button type="button" variant="outline" onClick={() => {
                  const supplier = suppliers.find((item) => item.id === purchaseForm.supplier_id)
                    ?? suppliers.find((item) => item.name.toLocaleUpperCase('pt-BR') === purchaseForm.supplier_name.trim().toLocaleUpperCase('pt-BR'));
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
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Fornecedor</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{purchases.map((purchase) => (
                  <TableRow key={purchase.id}><TableCell>{formatDate(purchase.purchase_date)}</TableCell><TableCell>{purchase.supplier_name || '-'}</TableCell><TableCell>{money(purchase.total_amount)}</TableCell><TableCell><Badge variant="outline">{purchase.status}</Badge></TableCell></TableRow>
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
                <Label>Produto cadastrado</Label>
                <Input
                  list="batch-products"
                  value={batchProductSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    const query = value.trim().toLocaleUpperCase('pt-BR');
                    const exactProduct = activeProducts.find((product) => product.name.toLocaleUpperCase('pt-BR') === query);
                    const matchingProducts = activeProducts.filter((product) => product.name.toLocaleUpperCase('pt-BR').startsWith(query));
                    const identifiedProduct = exactProduct ?? (matchingProducts.length === 1 ? matchingProducts[0] : null);
                    setBatchProductSearch(value);
                    setBatchForm((current) => ({ ...current, product_id: identifiedProduct?.id ?? '' }));
                  }}
                  placeholder="Digite o nome do produto"
                />
                <datalist id="batch-products">{activeProducts.map((product) => <option key={product.id} value={product.name} />)}</datalist>
                <p className="text-xs text-muted-foreground">{batchForm.product_id ? `Produto identificado: ${activeProducts.find((product) => product.id === batchForm.product_id)?.name}` : 'Digite até identificar um produto já cadastrado.'}</p>
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
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead>Qtd.</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{batches.map((batch) => {
                  const remaining = daysUntil(batch.expiration_date);
                  return (
                    <TableRow key={batch.id}>
                      <TableCell>{batch.product_name}</TableCell><TableCell>{batch.batch_code || '-'}</TableCell><TableCell>{formatDate(batch.expiration_date)}</TableCell><TableCell>{batch.quantity}</TableCell>
                      <TableCell><Badge variant={remaining < 0 ? 'destructive' : remaining <= batch.alert_days ? 'secondary' : 'outline'}>{remaining < 0 ? 'Vencido' : `${remaining} dias`}</Badge></TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

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
              <Button onClick={() => void refetch()} className="gap-2"><RefreshCw className="h-4 w-4" /> Sincronizar agora</Button>
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
      <SupplierOrderDialog
        open={supplierOrderOpen}
        initialSupplierId={supplierOrderInitialId}
        suppliers={suppliers.filter((supplier) => supplier.active)}
        products={activeProducts}
        onOpenChange={setSupplierOrderOpen}
        onSend={sendSupplierOrder}
      />
    </div>
  );
}
