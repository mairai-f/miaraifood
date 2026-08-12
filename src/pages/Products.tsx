import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/usePermissions';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, CalendarClock, Edit, Plus, Search, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import type { Product, ProductKind, ProductPackaging } from '@/types';
import { getMarginPercent, getMarkupPercent, getPriceFromMarkup, getUnitProfit } from '@/lib/pricing';
import { verifyPricingManagerApproval } from '@/lib/pricingManagerApproval';
import { parseDecimalInput } from '@/lib/numberInput';
import { filterProductsBySearch, toProductUppercase } from '@/lib/productSearch';
import { buildNextBatchByProductId, compareProductsByOperationalPriority, getProductPriorityState } from '@/lib/productOperationalPriority';
import { formatProductCode } from '@/lib/productCode';
import { getLocalIsoDate } from '@/lib/clientDebtDueDate';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { canUseDesktopFiscalModule } from '@/lib/fiscalAccess';
import { useProductBatches } from '@/hooks/useProductBatches';
import { supabase } from '@/integrations/supabase/client';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';
import type { SupplierRecord } from '@/types/operations';
import {
  filterSubgroupsByGroup,
  getCommissionValidationError,
  type CatalogOption,
  type CommissionType,
  type MeasurementUnitOption,
  type ProductPriceTableItem,
  type ProductPriceTableOption,
  type ProductSubgroupOption,
  type TransportCompanyOption,
} from '@/lib/catalog';

const LOW_MARGIN_WARNING_PCT = 15;
const productKindLabels: Record<ProductKind, string> = {
  simple: 'Produto simples',
  composite: 'Produto composto',
  raw_material: 'Matéria-prima',
};

interface DraftPriceRow extends ProductPriceTableItem {
  draftId: string;
}

interface DraftPackaging {
  draftId: string;
  name: string;
  base_quantity: number | string;
  barcode: string;
  purchase_cost: number | string;
  sale_price: number | string;
  auto_apply: boolean;
  closed_only: boolean;
}

export default function Products() {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    blockSaleWithoutStock,
    loading,
    updateStoreOperationalSettings,
  } = useData();
  const { session, user, ownerUserId, isAdmin } = useAuth();
  const { batches } = useProductBatches();
  const { hasPermission } = usePermissions();
  const { scope: operationalScope } = useOperationalScope();
  const isHeadquartersScope = operationalScope?.location.isHeadquarters ?? true;
  const { isDesktop, licensed, planId } = useDesktopRuntime();
  const desktopActivation = readDesktopActivation();
  const canEditFiscalProductData = canUseDesktopFiscalModule({
    isDesktop,
    licensed,
    planId,
    activation: desktopActivation,
  });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [productKind, setProductKind] = useState<ProductKind>('simple');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [category, setCategory] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [storeAccountId, setStoreAccountId] = useState('');
  const [departments, setDepartments] = useState<CatalogOption[]>([]);
  const [brands, setBrands] = useState<CatalogOption[]>([]);
  const [groups, setGroups] = useState<CatalogOption[]>([]);
  const [subgroups, setSubgroups] = useState<ProductSubgroupOption[]>([]);
  const [units, setUnits] = useState<MeasurementUnitOption[]>([]);
  const [priceTables, setPriceTables] = useState<ProductPriceTableOption[]>([]);
  const [transportCompanies, setTransportCompanies] = useState<TransportCompanyOption[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [subgroupId, setSubgroupId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [transportCompanyId, setTransportCompanyId] = useState('');
  const [reference, setReference] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('0');
  const [commissionType, setCommissionType] = useState<CommissionType>('none');
  const [commissionValue, setCommissionValue] = useState('0');
  const [priceRows, setPriceRows] = useState<DraftPriceRow[]>([]);
  const [packagingRows, setPackagingRows] = useState<DraftPackaging[]>([]);
  const [barcode, setBarcode] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [controlStock, setControlStock] = useState(true);
  const [productBlocksSaleWithoutStock, setProductBlocksSaleWithoutStock] = useState(true);
  const [fiscalNcm, setFiscalNcm] = useState('');
  const [fiscalCfop, setFiscalCfop] = useState('');
  const [fiscalOrigin, setFiscalOrigin] = useState('');
  const [fiscalCsosn, setFiscalCsosn] = useState('');
  const [fiscalPisCst, setFiscalPisCst] = useState('');
  const [fiscalCofinsCst, setFiscalCofinsCst] = useState('');
  const [fiscalUnit, setFiscalUnit] = useState('UN');
  const [fiscalGtin, setFiscalGtin] = useState('SEM GTIN');
  const [fiscalCest, setFiscalCest] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [expirationQuantity, setExpirationQuantity] = useState('');
  const [expirationAlertDays, setExpirationAlertDays] = useState('30');
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalEmail, setApprovalEmail] = useState('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [savingStockPolicy, setSavingStockPolicy] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ id: string; data: Partial<Product> } | null>(null);
  // A rota exige products.view; esta permissao adicional libera as mutacoes.
  const readOnly = !hasPermission('products.manage');
  const canManageStockPolicy = hasPermission('settings.manage');
  // Faixas sao administradas apenas no Web; o Desktop usa o preco principal
  // e recebe somente o resultado operacional, mantendo o bundle e o fluxo leves.
  const canManagePricing = !isDesktop && hasPermission('pricing.manage');
  const effectiveOwnerId = ownerUserId ?? user?.id ?? '';

  useEffect(() => {
    if (!effectiveOwnerId || readOnly || !open) return;
    const loadCatalogDependencies = async () => {
      try {
        // As tabelas serao tipadas automaticamente depois da migracao remota.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { data: accountId, error: accountError } = await db.rpc(
          'get_current_store_account_id_for_context',
          { target_context: 'happycash' },
        );
        if (accountError || !accountId) throw accountError ?? new Error('Empresa HappyCash nao encontrada.');
        const results = await Promise.all([
          db.from('suppliers').select('*').eq('owner_user_id', effectiveOwnerId).eq('active', true).order('name'),
          db.from('product_departments').select('*').eq('store_account_id', accountId).eq('active', true).order('name'),
          db.from('product_brands').select('*').eq('store_account_id', accountId).eq('active', true).order('name'),
          db.from('product_groups').select('*').eq('store_account_id', accountId).eq('active', true).order('name'),
          db.from('product_subgroups').select('*').eq('store_account_id', accountId).eq('active', true).order('name'),
          db.from('measurement_units').select('*').eq('store_account_id', accountId).eq('active', true).order('name'),
          canManagePricing
            ? db.from('product_price_tables').select('*').eq('store_account_id', accountId).eq('active', true).order('is_default', { ascending: false }).order('name')
            : Promise.resolve({ data: [], error: null }),
          db.from('transport_companies').select('*').eq('store_account_id', accountId).eq('active', true).order('name'),
          canManagePricing && editId
            ? db.from('product_price_table_items').select('*').eq('product_id', editId).eq('active', true).order('min_quantity')
            : Promise.resolve({ data: [], error: null }),
          editId
            ? db.from('product_packagings').select('*').eq('product_id', editId).eq('active', true).order('base_quantity', { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ]);
        const failed = results.find((result) => result.error);
        if (failed?.error) throw failed.error;
        const loadedPriceTables = (results[6].data ?? []) as ProductPriceTableOption[];
        const defaultTable = loadedPriceTables.find((table) => table.is_default);
        const loadedItems = (results[8].data ?? []) as ProductPriceTableItem[];
        setStoreAccountId(accountId as string);
        setSuppliers((results[0].data ?? []) as SupplierRecord[]);
        setDepartments((results[1].data ?? []) as CatalogOption[]);
        setBrands((results[2].data ?? []) as CatalogOption[]);
        setGroups((results[3].data ?? []) as CatalogOption[]);
        setSubgroups((results[4].data ?? []) as ProductSubgroupOption[]);
        const loadedUnits = (results[5].data ?? []) as MeasurementUnitOption[];
        setUnits(loadedUnits);
        if (!editId) setUnitId((current) => current || loadedUnits.find((unit) => unit.code === 'UN')?.id || '');
        setPriceTables(loadedPriceTables);
        setTransportCompanies((results[7].data ?? []) as TransportCompanyOption[]);
        setPriceRows(loadedItems
          .filter((item) => !(item.price_table_id === defaultTable?.id && Number(item.min_quantity) === 1))
          .map((item) => ({ ...item, draftId: item.id ?? crypto.randomUUID() })));
        setPackagingRows(((results[9].data ?? []) as ProductPackaging[]).map((item) => ({
          draftId: item.id,
          name: item.name,
          base_quantity: item.base_quantity,
          barcode: item.barcode,
          purchase_cost: item.purchase_cost,
          sale_price: item.sale_price,
          auto_apply: item.auto_apply,
          closed_only: item.closed_only,
        })));
      } catch (error) {
        console.error('Erro ao carregar dependencias do catalogo:', getRedactedLogValue(error));
        toast.error('Catalogo avancado indisponivel. Aplique a migracao da Fase 3.');
      }
    };
    void loadCatalogDependencies();
  }, [canManagePricing, editId, effectiveOwnerId, open, readOnly]);

  const activeProducts = useMemo(() => products.filter(p => !p.deleted), [products]);
  const todayKey = getLocalIsoDate();
  const nextBatchByProductId = useMemo(() => buildNextBatchByProductId(batches), [batches]);
  const filtered = useMemo(() => (
    [...filterProductsBySearch(activeProducts, search)]
      .sort((left, right) => compareProductsByOperationalPriority(left, right, nextBatchByProductId, todayKey))
  ), [activeProducts, nextBatchByProductId, search, todayKey]);

  const numericPrice = parseDecimalInput(price);
  const numericCostPrice = parseDecimalInput(costPrice);
  const previewMarkup = numericCostPrice > 0 ? getMarkupPercent(numericPrice, numericCostPrice) : 0;
  const previewMargin = numericPrice > 0 ? getMarginPercent(numericPrice, numericCostPrice) : 0;
  const priceBelowCost = numericPrice > 0 && numericPrice < numericCostPrice;
  const lowMargin = !priceBelowCost && previewMargin > 0 && previewMargin < LOW_MARGIN_WARNING_PCT;

  if (loading) {
    return <DataRouteLoader label="Carregando produtos..." />;
  }
  const availableSubgroups = filterSubgroupsByGroup(subgroups, groupId);

  const resetApprovalState = () => {
    setApprovalDialogOpen(false);
    setApprovalEmail('');
    setApprovalPassword('');
    setApprovalError('');
    setApprovalLoading(false);
    setPendingSave(null);
  };

  const syncAdditionalPriceRows = async (productId: string) => {
    if (!canManagePricing || !storeAccountId) return true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const payload = priceRows.map((row) => ({
        price_table_id: row.price_table_id,
        min_quantity: Math.max(0.001, Number(row.min_quantity) || 1),
        price: Math.max(0, Number(row.price) || 0),
        max_discount_pct: Math.min(100, Math.max(0, Number(row.max_discount_pct) || 0)),
      }));
      const { error } = await db.rpc('replace_product_price_table_items', {
        target_product_id: productId,
        target_items: payload,
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao salvar faixas de preco:', getRedactedLogValue(error));
      toast.error('Produto salvo, mas as faixas adicionais de preco nao foram atualizadas.');
      return false;
    }
  };

  const syncProductPackagings = async (productId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { error } = await db.rpc('replace_product_packagings', {
        target_product_id: productId,
        target_items: packagingRows.map((row) => ({
          name: row.name.trim(),
          base_quantity: parseDecimalInput(String(row.base_quantity)),
          barcode: row.barcode.trim(),
          purchase_cost: parseDecimalInput(String(row.purchase_cost)),
          sale_price: parseDecimalInput(String(row.sale_price)),
          auto_apply: row.closed_only ? false : row.auto_apply,
          closed_only: row.closed_only,
        })),
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao salvar embalagens:', getRedactedLogValue(error));
      toast.error('Produto salvo, mas as embalagens nao foram atualizadas.');
      return false;
    }
  };

  const persistSave = async (targetEditId: string | null, data: Partial<Product>) => {
    if (targetEditId) {
      try {
        await updateProduct(targetEditId, data);
        const [pricingSaved, packagingsSaved] = await Promise.all([
          syncAdditionalPriceRows(targetEditId),
          syncProductPackagings(targetEditId),
        ]);
        if (pricingSaved && packagingsSaved) toast.success('Produto atualizado!');
      } catch (error) {
        console.error('Erro ao atualizar produto:', getRedactedLogValue(error));
        toast.error(getPublicErrorMessage(error, 'Não foi possível atualizar o produto'));
        return;
      }
    } else {
      try {
        const createdProduct = await addProduct(data.name ?? '', data.price ?? 0, data.category ?? '', data);
        if (expirationDate) {
          const effectiveOwnerId = ownerUserId ?? user?.id;
          const quantity = Math.max(0, parseDecimalInput(expirationQuantity || stock));
          const { error } = await supabase.from('product_batches' as never).insert({
            owner_user_id: effectiveOwnerId,
            product_id: createdProduct.id,
            product_name: createdProduct.name,
            batch_code: batchCode.trim(),
            quantity,
            expiration_date: expirationDate,
            alert_days: Math.max(0, Number.parseInt(expirationAlertDays, 10) || 30),
            notes: 'Validade informada no cadastro do produto.',
          } as never);
          if (error) {
            console.error('Erro ao salvar validade do produto:', getRedactedLogValue(error));
            toast.error('Produto cadastrado, mas não foi possível salvar a validade.');
            resetForm();
            return;
          }
        }
        const [pricingSaved, packagingsSaved] = await Promise.all([
          syncAdditionalPriceRows(createdProduct.id),
          syncProductPackagings(createdProduct.id),
        ]);
        if (pricingSaved && packagingsSaved) toast.success('Produto cadastrado!');
      } catch (error) {
        console.error('Erro ao cadastrar produto:', getRedactedLogValue(error));
        toast.error(getPublicErrorMessage(error, 'Não foi possível cadastrar o produto'));
        return;
      }
    }
    resetForm();
  };

  const handleSave = async () => {
    if (!name.trim() || !price) { toast.error('Preencha nome e preço'); return; }
    if (supplierName.trim() && !supplierId) {
      toast.error('Escolha um fornecedor cadastrado ou deixe o campo vazio.');
      return;
    }
    const numericMaxDiscount = parseDecimalInput(maxDiscount);
    const numericCommission = parseDecimalInput(commissionValue);
    const commissionError = getCommissionValidationError(commissionType, numericCommission);
    if (numericMaxDiscount < 0 || numericMaxDiscount > 100) {
      toast.error('O desconto maximo deve ficar entre 0% e 100%.');
      return;
    }
    if (commissionError) {
      toast.error(commissionError);
      return;
    }
    if (subgroupId && !availableSubgroups.some((subgroup) => subgroup.id === subgroupId)) {
      toast.error('O subgrupo selecionado nao pertence ao grupo.');
      return;
    }
    if (canManagePricing && priceRows.some((row) => !row.price_table_id || Number(row.min_quantity) <= 0 || Number(row.price) < 0)) {
      toast.error('Revise tabela, quantidade minima e preco das faixas adicionais.');
      return;
    }
    if (canManagePricing) {
      const priceKeys = priceRows.map((row) => `${row.price_table_id}:${Number(row.min_quantity)}`);
      if (new Set(priceKeys).size !== priceKeys.length) {
        toast.error('Nao repita a mesma quantidade minima dentro de uma tabela de preco.');
        return;
      }
    }
    if (packagingRows.some((row) => (
      row.name.trim().length < 2
      || parseDecimalInput(String(row.base_quantity)) <= 1
      || parseDecimalInput(String(row.sale_price)) < 0
      || parseDecimalInput(String(row.purchase_cost)) < 0
    ))) {
      toast.error('Revise nome, quantidade, custo e preco das embalagens.');
      return;
    }
    const packagingBarcodes = packagingRows.map((row) => row.barcode.trim()).filter(Boolean);
    if (new Set(packagingBarcodes).size !== packagingBarcodes.length) {
      toast.error('Nao repita o codigo de barras entre embalagens.');
      return;
    }
    const selectedGroup = groups.find((group) => group.id === groupId);
    const data: Partial<Product> = {
      name: name.trim(),
      product_kind: productKind,
      price: parseDecimalInput(price),
      cost_price: parseDecimalInput(costPrice),
      category: selectedGroup?.name ?? category.trim(),
      supplier_id: supplierId || null,
      supplier_name: supplierName.trim(),
      barcode: barcode.trim(),
      department_id: departmentId || null,
      brand_id: brandId || null,
      product_group_id: groupId || null,
      product_subgroup_id: subgroupId || null,
      measurement_unit_id: unitId || null,
      primary_transport_company_id: transportCompanyId || null,
      reference: reference.trim(),
      max_discount_pct: numericMaxDiscount,
      commission_type: commissionType,
      commission_value: commissionType === 'none' ? 0 : numericCommission,
    };

    // products.stock e o espelho legado da Matriz. Em filiais, quantidade e
    // minimo sao alterados somente pelo modulo Estoque/location_inventory.
    if (isHeadquartersScope) {
      data.stock = parseInt(stock) || 0;
      data.min_stock = parseInt(minStock) || 0;
      data.max_stock = maxStock.trim() ? Math.max(0, parseDecimalInput(maxStock)) : null;
    }
    data.control_stock = controlStock;
    data.block_sale_without_stock = productBlocksSaleWithoutStock;

    if (canEditFiscalProductData) {
      Object.assign(data, {
        fiscal_ncm: fiscalNcm.replace(/\D/g, '').slice(0, 8) || null,
        fiscal_cfop: fiscalCfop.replace(/\D/g, '').slice(0, 4) || null,
        fiscal_origin: fiscalOrigin.trim() === '' ? null : Math.max(0, Math.min(8, Number.parseInt(fiscalOrigin, 10) || 0)),
        fiscal_csosn: fiscalCsosn.replace(/\D/g, '').slice(0, 3) || null,
        fiscal_pis_cst: fiscalPisCst.replace(/\D/g, '').slice(0, 2) || null,
        fiscal_cofins_cst: fiscalCofinsCst.replace(/\D/g, '').slice(0, 2) || null,
        fiscal_unit: toProductUppercase(fiscalUnit.trim() || 'UN').slice(0, 6),
        fiscal_gtin: toProductUppercase(fiscalGtin.trim() || 'SEM GTIN'),
        fiscal_cest: fiscalCest.replace(/\D/g, '').slice(0, 7) || null,
      });
    }

    if ((data.price ?? 0) < (data.cost_price ?? 0)) {
      toast.error('O preço de venda não pode ficar abaixo do custo real.');
      return;
    }

    if (lowMargin) {
      toast.warning(`Margem muito baixa: ${previewMargin.toFixed(1)}%. Revise antes de salvar.`);
    }

    if (editId) {
      const currentProduct = activeProducts.find(product => product.id === editId);
      const requiresApproval = currentProduct
        && (
          currentProduct.price !== data.price
          || currentProduct.cost_price !== data.cost_price
        );

      if (requiresApproval) {
        setPendingSave({ id: editId, data });
        setApprovalError('');
        setApprovalDialogOpen(true);
        return;
      }
    }

    await persistSave(editId, data);
  };

  const handleApprovalConfirm = async () => {
    if (!pendingSave) {
      setApprovalError('Nenhuma alteração pendente para aprovar.');
      return;
    }

    setApprovalLoading(true);
    setApprovalError('');

    await persistSave(pendingSave.id, pendingSave.data);
    resetApprovalState();
  };

  const resetForm = () => {
    setName('');
    setProductKind('simple');
    setPrice('');
    setCostPrice('');
    setCategory('');
    setSupplierId('');
    setSupplierName('');
    setDepartmentId('');
    setBrandId('');
    setGroupId('');
    setSubgroupId('');
    setUnitId('');
    setTransportCompanyId('');
    setReference('');
    setMaxDiscount('0');
    setCommissionType('none');
    setCommissionValue('0');
    setPriceRows([]);
    setPackagingRows([]);
    setBarcode('');
    setStock('');
    setMinStock('');
    setMaxStock('');
    setControlStock(true);
    setProductBlocksSaleWithoutStock(true);
    setFiscalNcm('');
    setFiscalCfop('');
    setFiscalOrigin('');
    setFiscalCsosn('');
    setFiscalPisCst('');
    setFiscalCofinsCst('');
    setFiscalUnit('UN');
    setFiscalGtin('SEM GTIN');
    setFiscalCest('');
    setBatchCode('');
    setExpirationDate('');
    setExpirationQuantity('');
    setExpirationAlertDays('30');
    setEditId(null);
    setOpen(false);
    resetApprovalState();
  };

  const openEdit = (p: Product) => {
    setEditId(p.id); setName(toProductUppercase(p.name)); setPrice(p.price.toString());
    setProductKind(p.product_kind ?? 'simple');
    setCostPrice((p.cost_price || 0).toString()); setCategory(toProductUppercase(p.category)); setSupplierId(p.supplier_id || ''); setSupplierName(toProductUppercase(p.supplier_name || ''));
    setBarcode(toProductUppercase(p.barcode || '')); setStock((p.stock || 0).toString()); setMinStock((p.min_stock || 0).toString());
    setMaxStock(p.max_stock == null ? '' : String(p.max_stock)); setControlStock(p.control_stock !== false);
    setProductBlocksSaleWithoutStock(p.block_sale_without_stock !== false);
    setDepartmentId(p.department_id || ''); setBrandId(p.brand_id || ''); setGroupId(p.product_group_id || ''); setSubgroupId(p.product_subgroup_id || '');
    setUnitId(p.measurement_unit_id || ''); setTransportCompanyId(p.primary_transport_company_id || ''); setReference(toProductUppercase(p.reference || ''));
    setMaxDiscount(String(p.max_discount_pct ?? 0)); setCommissionType(p.commission_type ?? 'none'); setCommissionValue(String(p.commission_value ?? 0));
    setFiscalNcm(p.fiscal_ncm || ''); setFiscalCfop(p.fiscal_cfop || ''); setFiscalOrigin(p.fiscal_origin === null || p.fiscal_origin === undefined ? '' : String(p.fiscal_origin));
    setFiscalCsosn(p.fiscal_csosn || ''); setFiscalPisCst(p.fiscal_pis_cst || ''); setFiscalCofinsCst(p.fiscal_cofins_cst || '');
    setFiscalUnit(toProductUppercase(p.fiscal_unit || 'UN')); setFiscalGtin(toProductUppercase(p.fiscal_gtin || 'SEM GTIN')); setFiscalCest(p.fiscal_cest || '');
    resetApprovalState();
    setOpen(true);
  };

  const addPriceRow = () => {
    const firstTable = priceTables.find((table) => !table.is_default) ?? priceTables[0];
    if (!firstTable) {
      toast.error('Cadastre uma tabela de preco nas Configuracoes Web.');
      return;
    }
    setPriceRows((current) => [...current, {
      draftId: crypto.randomUUID(),
      price_table_id: firstTable.id,
      product_id: editId ?? '',
      min_quantity: firstTable.is_default ? 2 : 1,
      price: parseDecimalInput(price),
      max_discount_pct: parseDecimalInput(maxDiscount),
      active: true,
    }]);
  };

  const updatePriceRow = (draftId: string, changes: Partial<DraftPriceRow>) => {
    setPriceRows((current) => current.map((row) => row.draftId === draftId ? { ...row, ...changes } : row));
  };

  const removePriceRow = (draftId: string) => {
    setPriceRows((current) => current.filter((row) => row.draftId !== draftId));
  };

  const addPackagingRow = () => {
    setPackagingRows((current) => [{
      draftId: crypto.randomUUID(),
      name: '',
      base_quantity: 2,
      barcode: '',
      purchase_cost: 0,
      sale_price: 0,
      auto_apply: true,
      closed_only: false,
    }, ...current]);
  };

  const updatePackagingRow = (draftId: string, changes: Partial<DraftPackaging>) => {
    setPackagingRows((current) => current.map((row) => row.draftId === draftId ? { ...row, ...changes } : row));
  };

  const removePackagingRow = (draftId: string) => {
    setPackagingRows((current) => current.filter((row) => row.draftId !== draftId));
  };

  const handleStockPolicyChange = async (nextValue: boolean) => {
    setSavingStockPolicy(true);

    try {
      await updateStoreOperationalSettings({ blockSaleWithoutStock: nextValue });
      toast.success(nextValue
        ? 'Venda sem saldo voltou a ser bloqueada para produtos com controle de estoque.'
        : 'Venda sem saldo liberada. O sistema pode levar o estoque para negativo.');
    } catch {
      toast.error('Nao foi possivel atualizar a politica de venda sem estoque agora.');
    } finally {
      setSavingStockPolicy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3" data-tour-id="products-header">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Produtos</h1>
          {readOnly && <p className="text-sm text-muted-foreground">Modo operador: consulta liberada, edição bloqueada.</p>}
        </div>
        {!readOnly && (
          <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild><Button size="sm" data-tour-id="products-new"><Plus className="h-4 w-4 mr-1" />Novo</Button></DialogTrigger>
            <DialogContent className="grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden p-3 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:gap-4 sm:p-6">
              <DialogHeader><DialogTitle>{editId ? 'Editar Produto' : 'Cadastrar Produto'}</DialogTitle></DialogHeader>
              <div className="min-h-0 min-w-0 space-y-3 overflow-y-auto overflow-x-hidden pr-1 pb-1 sm:pr-2">
                <div className="space-y-1"><Label>Nome / Marca</Label><Input value={name} onChange={e => setName(toProductUppercase(e.target.value))} placeholder="Ex: Skol 600ml" /></div>
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="product-kind-simple"
                      checked={productKind === 'simple'}
                      onCheckedChange={(checked) => setProductKind(checked ? 'simple' : 'composite')}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="product-kind-simple">Produto simples</Label>
                      <p className="text-xs text-muted-foreground">
                        Use simples para venda direta. Desmarque somente quando for composto ou materia-prima.
                      </p>
                    </div>
                  </div>
                  {productKind !== 'simple' && (
                    <div className="space-y-1">
                      <Label>Tipo do produto</Label>
                      <Select value={productKind} onValueChange={(value) => setProductKind(value as ProductKind)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="composite">Produto composto</SelectItem>
                          <SelectItem value="raw_material">Materia-prima</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Preço Venda (R$)</Label><Input type="text" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" /></div>
                  <div className="space-y-1"><Label>Custo Real (R$)</Label><Input type="text" inputMode="decimal" value={costPrice} onChange={e => {
                    const nextCost = e.target.value;
                    const previousCost = parseDecimalInput(costPrice);
                    const currentPrice = parseDecimalInput(price);
                    const preservedMarkup = previousCost > 0 && currentPrice > 0
                      ? getMarkupPercent(currentPrice, previousCost)
                      : 0;
                    setCostPrice(nextCost);
                    if (preservedMarkup > 0) {
                      const recalculatedPrice = getPriceFromMarkup(parseDecimalInput(nextCost), preservedMarkup);
                      setPrice(recalculatedPrice > 0 ? recalculatedPrice.toFixed(2) : '');
                    }
                  }} placeholder="0,00" /></div>
                </div>
                {price && costPrice && numericCostPrice > 0 && (
                  <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span>
                      Markup: <strong>{previewMarkup.toFixed(1)}%</strong>
                      {' • '}
                      Margem: <strong>{previewMargin.toFixed(1)}%</strong>
                    </span>
                  </div>
                )}
                {priceBelowCost && (
                  <Alert variant="destructive">
                    <AlertTitle>Preço abaixo do custo</AlertTitle>
                    <AlertDescription>Esse produto não pode ser salvo com preço menor que o custo real.</AlertDescription>
                  </Alert>
                )}
                {lowMargin && (
                  <Alert>
                    <AlertTitle>Margem muito baixa</AlertTitle>
                    <AlertDescription>A margem estimada está em {previewMargin.toFixed(1)}%.</AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Código de Barras</Label><Input value={barcode} onChange={e => setBarcode(toProductUppercase(e.target.value))} placeholder="EAN/UPC/ITF" /></div>
                  <div className="space-y-1"><Label>Referência</Label><Input value={reference} onChange={e => setReference(toProductUppercase(e.target.value))} placeholder="Código interno/fabricante" /></div>
                </div>
                <div className="space-y-3 rounded-md border p-3">
                  <div><p className="text-sm font-semibold">Classificação</p><p className="text-xs text-muted-foreground">Setores, marcas, grupos e unidades são administrados nas Configurações Web.</p></div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label>Setor</Label><Select value={departmentId || '__none'} onValueChange={(value) => setDepartmentId(value === '__none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger><SelectContent><SelectItem value="__none">Sem setor</SelectItem>{departments.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Marca</Label><Select value={brandId || '__none'} onValueChange={(value) => setBrandId(value === '__none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Sem marca" /></SelectTrigger><SelectContent><SelectItem value="__none">Sem marca</SelectItem>{brands.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Grupo</Label><Select value={groupId || '__none'} onValueChange={(value) => { const nextGroupId = value === '__none' ? '' : value; setGroupId(nextGroupId); setSubgroupId(''); setCategory(groups.find((row) => row.id === nextGroupId)?.name ?? ''); }}><SelectTrigger><SelectValue placeholder="Sem grupo" /></SelectTrigger><SelectContent><SelectItem value="__none">Sem grupo</SelectItem>{groups.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Subgrupo</Label><Select value={subgroupId || '__none'} onValueChange={(value) => setSubgroupId(value === '__none' ? '' : value)} disabled={!groupId}><SelectTrigger><SelectValue placeholder="Sem subgrupo" /></SelectTrigger><SelectContent><SelectItem value="__none">Sem subgrupo</SelectItem>{availableSubgroups.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Unidade comercial</Label><Select value={unitId} onValueChange={setUnitId}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{units.map((row) => <SelectItem key={row.id} value={row.id}>{row.name} ({row.symbol})</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Categoria legada</Label><Input value={category} onChange={e => setCategory(toProductUppercase(e.target.value))} disabled={Boolean(groupId)} placeholder="Compatibilidade" /></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Fornecedor principal</Label>
                  <Input
                    list="product-suppliers"
                    value={supplierName}
                    onChange={event => {
                      const value = toProductUppercase(event.target.value);
                      const supplier = suppliers.find((item) => item.name.toLocaleUpperCase('pt-BR') === value.trim());
                      setSupplierName(value);
                      setSupplierId(supplier?.id ?? '');
                    }}
                    placeholder="Escolha um fornecedor cadastrado"
                  />
                  <datalist id="product-suppliers">{suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}</datalist>
                  {supplierName && !supplierId && <p className="text-xs text-amber-600">Cadastre ou selecione este fornecedor em Operações para criar o vínculo.</p>}
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div><Label htmlFor="control-stock">Controlar estoque</Label><p className="text-xs text-muted-foreground">Controla saldo, baixa e validade. A trava de venda segue a configuracao global da loja.</p></div>
                  <Switch id="control-stock" checked={controlStock} onCheckedChange={setControlStock} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label htmlFor="product-block-sale-without-stock">Travar venda sem saldo neste produto</Label>
                    <p className="text-xs text-muted-foreground">
                      {!controlStock
                        ? 'Sem controle de estoque, este produto ja pode vender sem saldo e nao gera baixa.'
                        : blockSaleWithoutStock
                          ? 'Desligue apenas neste produto para permitir venda sem estoque sem liberar os demais itens da loja.'
                          : 'A trava global da loja esta desligada. Esta marcacao volta a valer quando a loja reativar a trava.'}
                    </p>
                  </div>
                  <Switch
                    id="product-block-sale-without-stock"
                    checked={productBlocksSaleWithoutStock}
                    disabled={!controlStock}
                    onCheckedChange={setProductBlocksSaleWithoutStock}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1"><Label>Estoque</Label><Input type="number" value={stock} disabled={!isHeadquartersScope || !controlStock} onChange={e => setStock(e.target.value)} placeholder="0" /></div>
                  <div className="space-y-1"><Label>Estoque Mínimo</Label><Input type="number" value={minStock} disabled={!isHeadquartersScope || !controlStock} onChange={e => setMinStock(e.target.value)} placeholder="0" /></div>
                  <div className="space-y-1"><Label>Estoque Máximo</Label><Input type="number" value={maxStock} disabled={!isHeadquartersScope || !controlStock} onChange={e => setMaxStock(e.target.value)} placeholder="Opcional" /></div>
                </div>
                {!isHeadquartersScope && (
                  <p className="text-xs text-muted-foreground">
                    Na filial {operationalScope?.location.name}, altere quantidades pelo modulo Estoque.
                  </p>
                )}
                {isAdmin && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Embalagens comerciais</p>
                        <p className="text-xs text-muted-foreground">Fardo, caixa ou pacote vinculados ao mesmo produto e estoque-base.</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={addPackagingRow}>
                        <Plus className="mr-1 h-3 w-3" /> Embalagem
                      </Button>
                    </div>
                    {packagingRows.map((row) => (
                      <div key={row.draftId} className="min-w-0 space-y-2 rounded-md bg-muted/40 p-2">
                        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-1 sm:col-span-2"><Label>Nome</Label><Input value={row.name} onChange={(event) => updatePackagingRow(row.draftId, { name: toProductUppercase(event.target.value) })} placeholder="FARDO COM 6" /></div>
                          <div className="space-y-1"><Label>Unidades</Label><Input type="number" min="2" step="1" value={row.base_quantity} onChange={(event) => updatePackagingRow(row.draftId, { base_quantity: event.target.value })} /></div>
                          <div className="space-y-1"><Label>Codigo de barras</Label><Input value={row.barcode} onChange={(event) => updatePackagingRow(row.draftId, { barcode: toProductUppercase(event.target.value) })} /></div>
                          <div className="space-y-1"><Label>Custo da embalagem</Label><Input inputMode="decimal" value={row.purchase_cost} onChange={(event) => updatePackagingRow(row.draftId, { purchase_cost: event.target.value })} /></div>
                          <div className="space-y-1"><Label>Preco da embalagem</Label><Input inputMode="decimal" value={row.sale_price} onChange={(event) => updatePackagingRow(row.draftId, { sale_price: event.target.value })} /></div>
                          <label className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs"><span>Aplicar ao atingir a quantidade</span><Switch checked={row.auto_apply} disabled={row.closed_only} onCheckedChange={(auto_apply) => updatePackagingRow(row.draftId, { auto_apply })} /></label>
                          <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs"><label className="flex flex-1 items-center justify-between gap-2"><span>Somente embalagem fechada</span><Switch checked={row.closed_only} onCheckedChange={(closed_only) => updatePackagingRow(row.draftId, { closed_only, auto_apply: closed_only ? false : row.auto_apply })} /></label><Button type="button" variant="ghost" size="icon" onClick={() => removePackagingRow(row.draftId)} aria-label="Remover embalagem"><Trash2 className="h-4 w-4" /></Button></div>
                        </div>
                      </div>
                    ))}
                    {packagingRows.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma embalagem. O produto sera vendido somente na unidade-base.</p>}
                  </div>
                )}
                <div className="space-y-3 rounded-md border p-3">
                  <div><p className="text-sm font-semibold">Política comercial</p><p className="text-xs text-muted-foreground">Limites aplicados ao produto em qualquer filial.</p></div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label>Desconto máximo (%)</Label><Input inputMode="decimal" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Tipo de comissão</Label><Select value={commissionType} onValueChange={(value) => { const nextType = value as CommissionType; setCommissionType(nextType); if (nextType === 'none') setCommissionValue('0'); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem comissão</SelectItem><SelectItem value="percent">Percentual</SelectItem><SelectItem value="amount">Valor fixo</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1"><Label>{commissionType === 'percent' ? 'Comissão (%)' : 'Comissão (R$)'}</Label><Input inputMode="decimal" value={commissionValue} disabled={commissionType === 'none'} onChange={e => setCommissionValue(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Transportadora preferencial</Label><Select value={transportCompanyId || '__none'} onValueChange={(value) => setTransportCompanyId(value === '__none' ? '' : value)}><SelectTrigger><SelectValue placeholder="Sem preferência" /></SelectTrigger><SelectContent><SelectItem value="__none">Sem preferência</SelectItem>{transportCompanies.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                </div>
                {canManagePricing && priceTables.length > 0 && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">Tabelas e faixas de preço</p><p className="text-xs text-muted-foreground">O preço Varejo para uma unidade é o preço principal acima.</p></div><Button type="button" size="sm" variant="outline" onClick={addPriceRow}><Plus className="mr-1 h-3 w-3" /> Faixa</Button></div>
                    {priceRows.map((row) => (
                      <div key={row.draftId} className="grid min-w-0 grid-cols-1 gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="space-y-1 sm:col-span-2"><Label>Tabela</Label><Select value={row.price_table_id} onValueChange={(value) => updatePriceRow(row.draftId, { price_table_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priceTables.map((table) => <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-1"><Label>Qtd. mínima</Label><Input type="number" min="0.001" step="0.001" value={row.min_quantity} onChange={(event) => updatePriceRow(row.draftId, { min_quantity: Number(event.target.value) })} /></div>
                        <div className="space-y-1"><Label>Preço</Label><Input inputMode="decimal" value={row.price} onChange={(event) => updatePriceRow(row.draftId, { price: parseDecimalInput(event.target.value) })} /></div>
                        <div className="space-y-1"><Label>Desc. máx. %</Label><div className="flex gap-1"><Input inputMode="decimal" value={row.max_discount_pct} onChange={(event) => updatePriceRow(row.draftId, { max_discount_pct: parseDecimalInput(event.target.value) })} /><Button type="button" variant="ghost" size="icon" onClick={() => removePriceRow(row.draftId)} aria-label="Remover faixa"><Trash2 className="h-4 w-4" /></Button></div></div>
                      </div>
                    ))}
                    {priceRows.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma faixa adicional. Use “Faixa” para atacado ou quantidade mínima.</p>}
                  </div>
                )}
                {canEditFiscalProductData && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div>
                      <p className="text-sm font-semibold">Fiscal para NFC-e</p>
                      <p className="text-xs text-muted-foreground">Disponivel somente no HappyCash Desktop PRO. Preencha com apoio do contador.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label>NCM</Label><Input inputMode="numeric" value={fiscalNcm} onChange={e => setFiscalNcm(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Ex: 22030000" /></div>
                      <div className="space-y-1"><Label>CFOP</Label><Input inputMode="numeric" value={fiscalCfop} onChange={e => setFiscalCfop(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Ex: 5102" /></div>
                      <div className="space-y-1"><Label>Origem</Label><Input inputMode="numeric" value={fiscalOrigin} onChange={e => setFiscalOrigin(e.target.value.replace(/[^\d]/g, '').slice(0, 1))} placeholder="0" /></div>
                      <div className="space-y-1"><Label>CSOSN</Label><Input inputMode="numeric" value={fiscalCsosn} onChange={e => setFiscalCsosn(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Ex: 102" /></div>
                      <div className="space-y-1"><Label>PIS CST</Label><Input inputMode="numeric" value={fiscalPisCst} onChange={e => setFiscalPisCst(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Ex: 07" /></div>
                      <div className="space-y-1"><Label>COFINS CST</Label><Input inputMode="numeric" value={fiscalCofinsCst} onChange={e => setFiscalCofinsCst(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Ex: 07" /></div>
                      <div className="space-y-1"><Label>Unidade</Label><Input value={fiscalUnit} onChange={e => setFiscalUnit(toProductUppercase(e.target.value).slice(0, 6))} placeholder="UN" /></div>
                      <div className="space-y-1"><Label>GTIN/EAN</Label><Input value={fiscalGtin} onChange={e => setFiscalGtin(toProductUppercase(e.target.value))} placeholder="SEM GTIN" /></div>
                      <div className="space-y-1"><Label>CEST</Label><Input inputMode="numeric" value={fiscalCest} onChange={e => setFiscalCest(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="Opcional" /></div>
                    </div>
                  </div>
                )}
                {!editId && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div><p className="text-sm font-semibold">Validade opcional</p><p className="text-xs text-muted-foreground">Preencha somente quando o produto tiver lote com vencimento.</p></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><Label>Lote</Label><Input value={batchCode} onChange={e => setBatchCode(e.target.value)} placeholder="Ex: LOTE-01" /></div>
                      <div className="space-y-1"><Label>Quantidade do lote</Label><Input type="number" min="0" value={expirationQuantity} onChange={e => setExpirationQuantity(e.target.value)} placeholder={stock || '0'} /></div>
                      <div className="space-y-1"><Label>Data de validade</Label><Input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} /></div>
                      <div className="space-y-1"><Label>Alertar com antecedência</Label><Input type="number" min="0" value={expirationAlertDays} onChange={e => setExpirationAlertDays(e.target.value)} /></div>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="shrink-0 border-t border-border pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
                <Button onClick={handleSave} className="w-full sm:w-auto">{editId ? 'Salvar' : 'Cadastrar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog
        open={approvalDialogOpen}
        onOpenChange={openState => {
          if (!openState) {
            resetApprovalState();
            return;
          }
          setApprovalDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar alteração</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a alterar informações sensíveis (como preço ou custo). Deseja confirmar esta operação?
            </p>
            {approvalError && (
              <Alert variant="destructive">
                <AlertTitle>Falha na aprovação</AlertTitle>
                <AlertDescription>{approvalError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetApprovalState} disabled={approvalLoading}>Cancelar</Button>
            <Button onClick={() => void handleApprovalConfirm()} disabled={approvalLoading}>
              {approvalLoading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canManageStockPolicy && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Travar venda sem saldo</p>
                <p className="text-sm text-muted-foreground">
                  Ligado: qualquer produto com controle de estoque trava no PDV e no fiado quando zerar.
                  Desligado: a venda pode levar o saldo para negativo.
                </p>
              </div>
              <Switch
                checked={blockSaleWithoutStock}
                disabled={savingStockPolicy || !ownerUserId}
                onCheckedChange={(checked) => void handleStockPolicyChange(checked)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative mb-4" data-tour-id="products-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(toProductUppercase(e.target.value))} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-tour-id="products-list">
        {filtered.map(p => {
          const markup = getMarkupPercent(p.price, p.cost_price);
          const margin = getMarginPercent(p.price, p.cost_price);
          const unitProfit = getUnitProfit(p.price, p.cost_price);
          const priority = getProductPriorityState(p, nextBatchByProductId.get(p.id), todayKey);
          const batch = priority.batch;
          const borderClass = priority.expired
            ? 'border-destructive/70'
            : priority.expiring
              ? 'border-amber-500/70'
              : priority.lowStock
                ? 'border-destructive/40'
                : priority.hasBatch
                  ? 'border-sky-500/40'
                  : '';
          return (
            <motion.div key={p.id} whileHover={{ scale: 1.02 }}>
              <Card className={`border-border/50 ${borderClass}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2 min-w-0">
                    <div className="min-w-0 mr-2">
                      <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                    <span className="text-xs text-muted-foreground">{formatProductCode(p.code) || 'Sem código'}{p.category ? ` - ${p.category}` : ''}</span>
                    {p.supplier_name && <p className="text-[11px] text-muted-foreground truncate">Fornecedor: {p.supplier_name}</p>}
                    {p.fiscal_ncm && <p className="text-[11px] text-muted-foreground truncate">Fiscal: NCM {p.fiscal_ncm}{p.fiscal_cfop ? ` | CFOP ${p.fiscal_cfop}` : ''}</p>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(p.product_kind ?? 'simple') !== 'simple' && <Badge variant="secondary" className="text-[10px]">{productKindLabels[p.product_kind ?? 'simple']}</Badge>}
                      {priority.expired && <Badge variant="destructive" className="gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />Vencido</Badge>}
                      {!priority.expired && priority.expiring && <Badge variant="secondary" className="gap-1 text-[10px]"><CalendarClock className="h-3 w-3" />Validade próxima</Badge>}
                      {priority.lowStock && <Badge variant="destructive" className="text-[10px]">Estoque mínimo</Badge>}
                      {!priority.expired && !priority.expiring && priority.hasBatch && <Badge variant="outline" className="text-[10px]">Lote monitorado</Badge>}
                    </div>
                  </div>
                    <span className="text-primary font-bold text-sm whitespace-nowrap">R$ {p.price.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground mb-2">
                    {p.cost_price > 0 && <span>Custo: R$ {p.cost_price.toFixed(2)}</span>}
                    {p.cost_price > 0 && <span className="text-primary font-medium">Markup: {markup.toFixed(1)}%</span>}
                    {p.cost_price > 0 && <span>Margem: {margin.toFixed(1)}%</span>}
                    {p.cost_price > 0 && <span>Lucro un.: R$ {unitProfit.toFixed(2)}</span>}
                    {margin > 0 && margin < LOW_MARGIN_WARNING_PCT && <span className="text-amber-600 font-medium">Margem baixa</span>}
                    {p.min_stock > 0 && <span>Mín: {p.min_stock}</span>}
                    <span className={p.stock <= p.min_stock && p.min_stock > 0 ? 'text-destructive font-bold' : ''}>Est: {p.stock}</span>
                  </div>
                  {batch && (
                    <p className={`mb-2 flex items-center gap-1 text-[11px] ${priority.expired ? 'text-destructive' : 'text-amber-600'}`}>
                      <CalendarClock className="h-3 w-3" />
                      Validade: {new Date(`${batch.expiration_date}T12:00:00`).toLocaleDateString('pt-BR')} · lote {batch.batch_code || 'não informado'}
                    </p>
                  )}
                  {!readOnly && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEdit(p)}><Edit className="h-3 w-3 mr-1" />Editar</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="flex-1 text-xs"><Trash2 className="h-3 w-3 mr-1" />Excluir</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir produto?</AlertDialogTitle><AlertDialogDescription>"{p.name}" será removido permanentemente.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { deleteProduct(p.id); toast.success('Produto excluído'); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-center text-muted-foreground mt-8 text-sm">Nenhum produto encontrado.</p>}
    </div>
  );
}
