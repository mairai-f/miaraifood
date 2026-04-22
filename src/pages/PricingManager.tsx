import { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Calculator, Package, Pencil, Save, Search, Sparkles, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Product, ProductCategoryPricingRule, PricingRoundingRule } from '@/types';
import {
  applyPricingRuleToProduct,
  applyPricingRounding,
  getMarginPercent,
  getMarkupFromPrice,
  getMarkupPercent,
  getRealCost,
  getSuggestedPrice,
  getTotalExtraCosts,
  getUnitProfit,
  normalizeProductPricing,
  normalizePricingRoundingRule,
  pricingRoundingLabels,
  PRICING_ROUNDING_RULES,
} from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { verifyPricingManagerApproval } from '@/lib/pricingManagerApproval';

type ProductFormState = {
  id: string | null;
  name: string;
  category: string;
  supplier_name: string;
  barcode: string;
  stock: string;
  min_stock: string;
  purchase_cost: string;
  freight_cost: string;
  tax_cost: string;
  commission_cost: string;
  card_fee_cost: string;
  packaging_cost: string;
  operational_cost: string;
  other_extra_cost: string;
  price: string;
  target_markup_pct: string;
  minimum_markup_pct: string;
  minimum_price: string;
  rounding_rule: PricingRoundingRule;
  pricing_notes: string;
};

type RuleFormState = {
  id: string | null;
  category: string;
  default_markup_pct: string;
  minimum_markup_pct: string;
  minimum_price: string;
  rounding_rule: PricingRoundingRule;
  notes: string;
};

type SimulatorFormState = {
  purchase_cost: string;
  freight_cost: string;
  tax_cost: string;
  commission_cost: string;
  card_fee_cost: string;
  packaging_cost: string;
  operational_cost: string;
  other_extra_cost: string;
  price: string;
  target_markup_pct: string;
  discount_amount: string;
  rounding_rule: PricingRoundingRule;
};

type PendingPricingApproval = {
  kind: 'product';
  productId: string;
  payload: Partial<Product>;
} | {
  kind: 'rule';
  ruleId: string | null;
  payload: {
    category: string;
    default_markup_pct: number;
    minimum_markup_pct: number;
    minimum_price: number;
    rounding_rule: PricingRoundingRule;
    notes: string;
  };
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const categoryKey = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
const formatMoney = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);
const formatPercent = (value: number) => `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;
const LOW_MARGIN_WARNING_PCT = 15;
const toNumber = (value: string | number | null | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const toInteger = (value: string | number | null | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};
const toInput = (value: number | null | undefined) => (Number.isFinite(value ?? NaN) && Number(value) !== 0 ? String(value) : '');

const createEmptyProductForm = (): ProductFormState => ({
  id: null,
  name: '',
  category: '',
  supplier_name: '',
  barcode: '',
  stock: '',
  min_stock: '',
  purchase_cost: '',
  freight_cost: '',
  tax_cost: '',
  commission_cost: '',
  card_fee_cost: '',
  packaging_cost: '',
  operational_cost: '',
  other_extra_cost: '',
  price: '',
  target_markup_pct: '',
  minimum_markup_pct: '',
  minimum_price: '',
  rounding_rule: 'none',
  pricing_notes: '',
});

const createEmptyRuleForm = (): RuleFormState => ({
  id: null,
  category: '',
  default_markup_pct: '',
  minimum_markup_pct: '',
  minimum_price: '',
  rounding_rule: 'none',
  notes: '',
});

const createEmptySimulatorForm = (): SimulatorFormState => ({
  purchase_cost: '',
  freight_cost: '',
  tax_cost: '',
  commission_cost: '',
  card_fee_cost: '',
  packaging_cost: '',
  operational_cost: '',
  other_extra_cost: '',
  price: '',
  target_markup_pct: '',
  discount_amount: '',
  rounding_rule: 'none',
});

const productToForm = (product: Product): ProductFormState => ({
  id: product.id,
  name: product.name,
  category: product.category ?? '',
  supplier_name: product.supplier_name ?? '',
  barcode: product.barcode ?? '',
  stock: String(product.stock ?? 0),
  min_stock: String(product.min_stock ?? 0),
  purchase_cost: toInput(product.purchase_cost ?? product.cost_price ?? 0),
  freight_cost: toInput(product.freight_cost),
  tax_cost: toInput(product.tax_cost),
  commission_cost: toInput(product.commission_cost),
  card_fee_cost: toInput(product.card_fee_cost),
  packaging_cost: toInput(product.packaging_cost),
  operational_cost: toInput(product.operational_cost),
  other_extra_cost: toInput(product.other_extra_cost),
  price: toInput(product.price),
  target_markup_pct: toInput(product.target_markup_pct),
  minimum_markup_pct: toInput(product.minimum_markup_pct),
  minimum_price: toInput(product.minimum_price),
  rounding_rule: normalizePricingRoundingRule(product.rounding_rule),
  pricing_notes: product.pricing_notes ?? '',
});

const ruleToForm = (rule: ProductCategoryPricingRule): RuleFormState => ({
  id: rule.id,
  category: rule.category,
  default_markup_pct: toInput(rule.default_markup_pct),
  minimum_markup_pct: toInput(rule.minimum_markup_pct),
  minimum_price: toInput(rule.minimum_price),
  rounding_rule: normalizePricingRoundingRule(rule.rounding_rule),
  notes: rule.notes ?? '',
});

const formToProductPayload = (form: ProductFormState) => normalizeProductPricing({
  name: form.name.trim(),
  category: form.category.trim(),
  supplier_name: form.supplier_name.trim(),
  barcode: form.barcode.trim(),
  stock: Math.max(0, toInteger(form.stock)),
  min_stock: Math.max(0, toInteger(form.min_stock)),
  purchase_cost: toNumber(form.purchase_cost),
  freight_cost: toNumber(form.freight_cost),
  tax_cost: toNumber(form.tax_cost),
  commission_cost: toNumber(form.commission_cost),
  card_fee_cost: toNumber(form.card_fee_cost),
  packaging_cost: toNumber(form.packaging_cost),
  operational_cost: toNumber(form.operational_cost),
  other_extra_cost: toNumber(form.other_extra_cost),
  price: toNumber(form.price),
  target_markup_pct: toNumber(form.target_markup_pct),
  minimum_markup_pct: toNumber(form.minimum_markup_pct),
  minimum_price: toNumber(form.minimum_price),
  rounding_rule: form.rounding_rule,
  pricing_notes: form.pricing_notes.trim(),
});

const formToRulePayload = (form: RuleFormState) => ({
  category: form.category.trim(),
  default_markup_pct: toNumber(form.default_markup_pct),
  minimum_markup_pct: toNumber(form.minimum_markup_pct),
  minimum_price: toNumber(form.minimum_price),
  rounding_rule: form.rounding_rule,
  notes: form.notes.trim(),
});

const simulatorToProductLike = (form: SimulatorFormState) => ({
  purchase_cost: toNumber(form.purchase_cost),
  freight_cost: toNumber(form.freight_cost),
  tax_cost: toNumber(form.tax_cost),
  commission_cost: toNumber(form.commission_cost),
  card_fee_cost: toNumber(form.card_fee_cost),
  packaging_cost: toNumber(form.packaging_cost),
  operational_cost: toNumber(form.operational_cost),
  other_extra_cost: toNumber(form.other_extra_cost),
  price: toNumber(form.price),
  target_markup_pct: toNumber(form.target_markup_pct),
  rounding_rule: form.rounding_rule,
});

const hasPricingChangeRequiringApproval = (currentProduct: Product, nextProduct: Partial<Product>) => {
  const currentCost = Number(currentProduct.cost_price ?? 0);
  const nextCost = Number(nextProduct.cost_price ?? 0);
  const currentPrice = Number(currentProduct.price ?? 0);
  const nextPrice = Number(nextProduct.price ?? 0);
  const currentTargetMarkup = Number(currentProduct.target_markup_pct ?? 0);
  const nextTargetMarkup = Number(nextProduct.target_markup_pct ?? 0);
  const currentMinimumMarkup = Number(currentProduct.minimum_markup_pct ?? 0);
  const nextMinimumMarkup = Number(nextProduct.minimum_markup_pct ?? 0);
  const currentMinimumPrice = Number(currentProduct.minimum_price ?? 0);
  const nextMinimumPrice = Number(nextProduct.minimum_price ?? 0);

  return (
    currentCost !== nextCost
    || currentPrice !== nextPrice
    || currentTargetMarkup !== nextTargetMarkup
    || currentMinimumMarkup !== nextMinimumMarkup
    || currentMinimumPrice !== nextMinimumPrice
  );
};

export default function PricingManager() {
  const { session } = useAuth();
  const {
    products,
    pricingRules,
    priceHistory,
    saleItems,
    sales,
    addProduct,
    updateProduct,
    addPricingRule,
    updatePricingRule,
    deletePricingRule,
  } = useData();

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(createEmptyProductForm());
  const [productSyncMode, setProductSyncMode] = useState<'markup' | 'price'>('markup');
  const [ruleForm, setRuleForm] = useState<RuleFormState>(createEmptyRuleForm());
  const [simulatorForm, setSimulatorForm] = useState<SimulatorFormState>(createEmptySimulatorForm());
  const [simulatorSyncMode, setSimulatorSyncMode] = useState<'markup' | 'price'>('markup');
  const [managerApprovalDialogOpen, setManagerApprovalDialogOpen] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerApprovalError, setManagerApprovalError] = useState('');
  const [managerApprovalLoading, setManagerApprovalLoading] = useState(false);
  const [pendingPricingApproval, setPendingPricingApproval] = useState<PendingPricingApproval | null>(null);

  const activeProducts = useMemo(
    () => products.filter((product) => !product.deleted),
    [products],
  );

  const rulesByCategory = useMemo(() => {
    const nextMap = new Map<string, ProductCategoryPricingRule>();
    pricingRules.forEach((rule) => {
      nextMap.set(categoryKey(rule.category), rule);
    });
    return nextMap;
  }, [pricingRules]);

  const pricingRows = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return activeProducts
      .map((product) => {
        const rule = rulesByCategory.get(categoryKey(product.category));
        const realCost = getRealCost(product);
        const markup = getMarkupPercent(product.price, realCost);
        const margin = getMarginPercent(product.price, realCost);
        const unitProfit = getUnitProfit(product.price, realCost);
        const suggestedPrice = getSuggestedPrice(product, rule);
        const targetMarkup = (product.target_markup_pct ?? 0) > 0
          ? product.target_markup_pct ?? 0
          : rule?.default_markup_pct ?? 0;
        const minimumMarkup = Math.max(product.minimum_markup_pct ?? 0, rule?.minimum_markup_pct ?? 0);
        const minimumPrice = Math.max(product.minimum_price ?? 0, rule?.minimum_price ?? 0);
        const idealMarkup = Math.max(targetMarkup, minimumMarkup);
        const belowIdeal = markup < idealMarkup || product.price < minimumPrice;

        return {
          product,
          rule,
          realCost,
          extraCosts: getTotalExtraCosts(product),
          markup,
          margin,
          unitProfit,
          suggestedPrice,
          idealMarkup,
          minimumMarkup,
          minimumPrice,
          belowIdeal,
        };
      })
      .filter(({ product }) => {
        if (!query) return true;

        return (
          product.name.toLowerCase().includes(query)
          || product.category.toLowerCase().includes(query)
          || (product.supplier_name ?? '').toLowerCase().includes(query)
          || (product.barcode ?? '').toLowerCase().includes(query)
        );
      })
      .sort((left, right) => left.product.name.localeCompare(right.product.name));
  }, [activeProducts, deferredSearch, rulesByCategory]);

  const productPreview = useMemo(() => formToProductPayload(productForm), [productForm]);
  const previewRule = useMemo(
    () => rulesByCategory.get(categoryKey(productForm.category)),
    [productForm.category, rulesByCategory],
  );
  const previewRealCost = useMemo(() => getRealCost(productPreview), [productPreview]);
  const previewMarkup = useMemo(() => getMarkupPercent(productPreview.price ?? 0, previewRealCost), [productPreview, previewRealCost]);
  const previewMargin = useMemo(() => getMarginPercent(productPreview.price ?? 0, previewRealCost), [productPreview, previewRealCost]);
  const previewProfit = useMemo(() => getUnitProfit(productPreview.price ?? 0, previewRealCost), [productPreview, previewRealCost]);
  const previewSuggestedPrice = useMemo(() => getSuggestedPrice(productPreview, previewRule), [productPreview, previewRule]);

  const simulatorPreview = useMemo(() => simulatorToProductLike(simulatorForm), [simulatorForm]);
  const simulatorRealCost = useMemo(() => getRealCost(simulatorPreview), [simulatorPreview]);
  const simulatorSuggestedPrice = useMemo(() => getSuggestedPrice(simulatorPreview), [simulatorPreview]);
  const simulatorNetPrice = Math.max(0, toNumber(simulatorForm.price) - toNumber(simulatorForm.discount_amount));
  const simulatorGrossProfit = getUnitProfit(toNumber(simulatorForm.price), simulatorRealCost);
  const simulatorNetProfit = getUnitProfit(simulatorNetPrice, simulatorRealCost);
  const simulatorMargin = getMarginPercent(toNumber(simulatorForm.price), simulatorRealCost);
  const simulatorDiscountMargin = getMarginPercent(simulatorNetPrice, simulatorRealCost);

  const salesById = useMemo(() => new Map(sales.map((sale) => [sale.id, sale])), [sales]);
  const productById = useMemo(() => new Map(activeProducts.map((product) => [product.id, product])), [activeProducts]);

  const saleItemsMetrics = useMemo(
    () => saleItems
      .filter((item) => salesById.get(item.sale_id)?.status !== 'cancelled')
      .map((item) => {
      const discountAmount = item.discount_amount ?? 0;
      const netTotal = item.net_total ?? Math.max(0, item.total - discountAmount);
      const totalProfit = item.total_profit ?? (netTotal - item.cost_price * item.quantity);
      const unitProfit = item.unit_profit ?? (item.quantity > 0 ? totalProfit / item.quantity : 0);

      return {
        ...item,
        discount_amount: discountAmount,
        net_total: netTotal,
        total_profit: totalProfit,
        unit_profit: unitProfit,
        markup_pct: item.markup_pct ?? getMarkupPercent(item.unit_price, item.cost_price),
        margin_pct: item.margin_pct ?? getMarginPercent(item.unit_price, item.cost_price),
      };
    }),
    [saleItems, salesById],
  );

  const profitByProduct = useMemo(() => {
    const profitMap = new Map<string, { name: string; profit: number; quantity: number }>();

    saleItemsMetrics.forEach((item) => {
      const key = item.product_id ?? item.product_name;
      const current = profitMap.get(key) ?? { name: item.product_name, profit: 0, quantity: 0 };
      current.profit += item.total_profit ?? 0;
      current.quantity += item.quantity;
      profitMap.set(key, current);
    });

    return Array.from(profitMap.values()).sort((a, b) => b.profit - a.profit);
  }, [saleItemsMetrics]);

  const categoryProfit = useMemo(() => {
    const categoryMap = new Map<string, { category: string; profit: number; revenue: number }>();

    saleItemsMetrics.forEach((item) => {
      const category = productById.get(item.product_id ?? '')?.category || 'Sem categoria';
      const current = categoryMap.get(category) ?? { category, profit: 0, revenue: 0 };
      current.profit += item.total_profit ?? 0;
      current.revenue += item.net_total ?? item.total;
      categoryMap.set(category, current);
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.profit - a.profit);
  }, [productById, saleItemsMetrics]);

  const operatorProfit = useMemo(() => {
    const operatorMap = new Map<string, { name: string; profit: number; revenue: number }>();

    saleItemsMetrics.forEach((item) => {
      const sale = salesById.get(item.sale_id);
      const operatorName = sale?.seller_name || 'Sem operador';
      const current = operatorMap.get(operatorName) ?? { name: operatorName, profit: 0, revenue: 0 };
      current.profit += item.total_profit ?? 0;
      current.revenue += item.net_total ?? item.total;
      operatorMap.set(operatorName, current);
    });

    return Array.from(operatorMap.values()).sort((a, b) => b.profit - a.profit);
  }, [saleItemsMetrics, salesById]);

  const totalDiscountImpact = useMemo(
    () => saleItemsMetrics.reduce((sum, item) => sum + (item.discount_amount ?? 0), 0),
    [saleItemsMetrics],
  );

  const grossProfitBeforeDiscount = useMemo(
    () => saleItemsMetrics.reduce((sum, item) => sum + (item.total - item.cost_price * item.quantity), 0),
    [saleItemsMetrics],
  );

  const grossProfitAfterDiscount = useMemo(
    () => saleItemsMetrics.reduce((sum, item) => sum + (item.total_profit ?? ((item.net_total ?? item.total) - item.cost_price * item.quantity)), 0),
    [saleItemsMetrics],
  );

  const belowIdealCount = pricingRows.filter((row) => row.belowIdeal).length;
  const averageMargin = pricingRows.length > 0
    ? pricingRows.reduce((sum, row) => sum + row.margin, 0) / pricingRows.length
    : 0;

  const currentEditedProduct = useMemo(
    () => (productForm.id ? activeProducts.find((product) => product.id === productForm.id) ?? null : null),
    [activeProducts, productForm.id],
  );
  const selectedCategoryRule = rulesByCategory.get(categoryKey(productForm.category));
  const previewBelowCost = (productPreview.price ?? 0) < previewRealCost;
  const previewLowMargin = !previewBelowCost && previewMargin > 0 && previewMargin < LOW_MARGIN_WARNING_PCT;
  const simulatorDiscountKillsProfit = toNumber(simulatorForm.discount_amount) > 0 && simulatorNetProfit <= 0;
  const filteredPriceHistory = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return priceHistory.slice(0, 80);

    return priceHistory
      .filter((entry) => entry.product_name.toLowerCase().includes(query))
      .slice(0, 80);
  }, [deferredSearch, priceHistory]);

  const resetManagerApprovalState = () => {
    setManagerApprovalDialogOpen(false);
    setManagerEmail('');
    setManagerPassword('');
    setManagerApprovalError('');
    setManagerApprovalLoading(false);
    setPendingPricingApproval(null);
  };

  const resetProductForm = () => {
    setProductForm(createEmptyProductForm());
    setProductSyncMode('markup');
    resetManagerApprovalState();
  };

  const resetRuleForm = () => {
    setRuleForm(createEmptyRuleForm());
  };

  const syncProductWithMode = (draft: ProductFormState, mode: 'markup' | 'price') => {
    const payload = formToProductPayload(draft);
    const realCost = getRealCost(payload);

    if (mode === 'markup') {
      const nextPrice = applyPricingRounding(
        realCost * (1 + toNumber(draft.target_markup_pct) / 100),
        draft.rounding_rule,
      );

      return { ...draft, price: nextPrice > 0 ? String(nextPrice) : '' };
    }

    return {
      ...draft,
      target_markup_pct: realCost > 0 ? String(getMarkupFromPrice(realCost, toNumber(draft.price))) : '',
    };
  };

  const updateProductForm = (field: keyof ProductFormState, value: string) => {
    setProductForm((current) => {
      const next = { ...current, [field]: value };

      if (
        field === 'purchase_cost'
        || field === 'freight_cost'
        || field === 'tax_cost'
        || field === 'commission_cost'
        || field === 'card_fee_cost'
        || field === 'packaging_cost'
        || field === 'operational_cost'
        || field === 'other_extra_cost'
        || field === 'rounding_rule'
      ) {
        return syncProductWithMode(next, productSyncMode);
      }

      return next;
    });
  };

  const openCreateDialog = () => {
    resetProductForm();
    setProductDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setProductForm(productToForm(product));
    setProductSyncMode('markup');
    setProductDialogOpen(true);
  };

  const applyRuleToCurrentProduct = () => {
    if (!selectedCategoryRule) {
      toast.error('Escolha uma categoria com regra cadastrada.');
      return;
    }

    const nextProduct = applyPricingRuleToProduct(formToProductPayload(productForm), selectedCategoryRule);

    setProductForm((current) => ({
      ...current,
      target_markup_pct: toInput(nextProduct.target_markup_pct),
      minimum_markup_pct: toInput(nextProduct.minimum_markup_pct),
      minimum_price: toInput(nextProduct.minimum_price),
      rounding_rule: normalizePricingRoundingRule(nextProduct.rounding_rule),
      price: toInput(nextProduct.price),
    }));

    setProductSyncMode('markup');
  };

  const persistProductSave = async (productId: string | null, payload: Partial<Product>) => {
    try {
      if (productId) {
        await updateProduct(productId, payload);
        toast.success('Precificação do produto atualizada.');
      } else {
        await addProduct(payload.name ?? '', payload.price ?? 0, payload.category ?? '', payload);
        toast.success('Produto criado com precificação completa.');
      }

      setProductDialogOpen(false);
      resetProductForm();
      resetManagerApprovalState();
    } catch (error) {
      console.error('Erro ao salvar produto na precificação:', error);
      toast.error(typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Não foi possível salvar a precificação do produto.');
    }
  };

  const persistRuleSave = async (
    ruleId: string | null,
    payload: {
      category: string;
      default_markup_pct: number;
      minimum_markup_pct: number;
      minimum_price: number;
      rounding_rule: PricingRoundingRule;
      notes: string;
    },
  ) => {
    try {
      if (ruleId) {
        await updatePricingRule(ruleId, payload);
        toast.success('Regra de categoria atualizada.');
      } else {
        await addPricingRule(payload);
        toast.success('Regra de categoria criada.');
      }

      resetRuleForm();
      resetManagerApprovalState();
    } catch (error) {
      console.error('Erro ao salvar regra de precificação:', error);
      toast.error('Não foi possível salvar a regra.');
    }
  };

  const handleProductSave = async () => {
    const payload = formToProductPayload(productForm);

    if (!payload.name?.trim()) {
      toast.error('Informe o nome do produto.');
      return;
    }

    if ((payload.price ?? 0) <= 0) {
      toast.error('Informe o preço de venda.');
      return;
    }

    if ((payload.price ?? 0) < (payload.cost_price ?? 0)) {
      toast.error('O preço de venda não pode ficar abaixo do custo real.');
      return;
    }

    if (previewLowMargin) {
      toast.warning(`Margem muito baixa: ${formatPercent(previewMargin)}. Revise antes de salvar.`);
    }

    if (productForm.id && currentEditedProduct && hasPricingChangeRequiringApproval(currentEditedProduct, payload)) {
      setPendingPricingApproval({
        kind: 'product',
        productId: productForm.id,
        payload,
      });
      setManagerApprovalError('');
      setManagerApprovalDialogOpen(true);
      return;
    }

    await persistProductSave(productForm.id, payload);
  };

  const handleManagerApproval = async () => {
    if (!session?.access_token) {
      setManagerApprovalError('Sua sessão expirou. Faça login novamente.');
      return;
    }

    if (!pendingPricingApproval) {
      setManagerApprovalError('Nenhuma alteração pendente para aprovar.');
      return;
    }

    if (!managerEmail.trim() || !managerPassword.trim()) {
      setManagerApprovalError('Informe login e senha do gerente.');
      return;
    }

    setManagerApprovalLoading(true);
    setManagerApprovalError('');

    const approval = await verifyPricingManagerApproval(
      session.access_token,
      managerEmail,
      managerPassword,
    );

    setManagerApprovalLoading(false);

    if (!approval.success) {
      setManagerApprovalError(approval.error || 'Não foi possível validar a aprovação.');
      return;
    }

    if (pendingPricingApproval.kind === 'product') {
      await persistProductSave(pendingPricingApproval.productId, pendingPricingApproval.payload);
      return;
    }

    await persistRuleSave(pendingPricingApproval.ruleId, pendingPricingApproval.payload);
  };

  const handleRuleSave = async () => {
    const payload = formToRulePayload(ruleForm);

    if (!payload.category) {
      toast.error('Informe a categoria da regra.');
      return;
    }

    setPendingPricingApproval({
      kind: 'rule',
      ruleId: ruleForm.id,
      payload,
    });
    setManagerApprovalError('');
    setManagerApprovalDialogOpen(true);
  };

  const handleDeleteRule = async (rule: ProductCategoryPricingRule) => {
    if (!window.confirm(`Excluir a regra da categoria "${rule.category}"?`)) {
      return;
    }

    try {
      await deletePricingRule(rule.id);
      toast.success('Regra removida.');
      if (ruleForm.id === rule.id) {
        resetRuleForm();
      }
    } catch (error) {
      console.error('Erro ao excluir regra:', error);
      toast.error('Não foi possível excluir a regra.');
    }
  };

  const applySuggestedPriceToProduct = async (product: Product) => {
    const rule = rulesByCategory.get(categoryKey(product.category));
    const nextPrice = getSuggestedPrice(product, rule);

    try {
      await updateProduct(product.id, { price: nextPrice });
      toast.success(`Preço sugerido aplicado em ${product.name}.`);
    } catch (error) {
      console.error('Erro ao aplicar preço sugerido:', error);
      toast.error('Não foi possível aplicar o preço sugerido.');
    }
  };

  const updateSimulatorForm = (field: keyof SimulatorFormState, value: string) => {
    setSimulatorForm((current) => {
      const next = { ...current, [field]: value };
      const productLike = simulatorToProductLike(next);
      const realCost = getRealCost(productLike);

      if (
        field === 'purchase_cost'
        || field === 'freight_cost'
        || field === 'tax_cost'
        || field === 'commission_cost'
        || field === 'card_fee_cost'
        || field === 'packaging_cost'
        || field === 'operational_cost'
        || field === 'other_extra_cost'
        || field === 'rounding_rule'
      ) {
        if (simulatorSyncMode === 'markup') {
          const price = applyPricingRounding(realCost * (1 + toNumber(next.target_markup_pct) / 100), next.rounding_rule);
          return { ...next, price: price > 0 ? String(price) : '' };
        }

        return {
          ...next,
          target_markup_pct: realCost > 0 ? String(getMarkupFromPrice(realCost, toNumber(next.price))) : '',
        };
      }

      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Precificação Inteligente</h1>
          <p className="text-sm text-muted-foreground">
            Custo real, markup, margem, simulador e análise de lucro em um módulo só.
          </p>
        </div>
        <Dialog
          open={productDialogOpen}
          onOpenChange={(open) => {
            setProductDialogOpen(open);
            if (!open) resetProductForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Sparkles className="mr-2 h-4 w-4" />
              Novo produto com precificação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{productForm.id ? 'Editar precificação' : 'Cadastrar produto com precificação'}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Nome do produto</Label>
                    <Input value={productForm.name} onChange={(event) => updateProductForm('name', event.target.value)} placeholder="Ex: Refrigerante 2L" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Categoria</Label>
                    <Input value={productForm.category} onChange={(event) => updateProductForm('category', event.target.value)} placeholder="Ex: Bebidas" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fornecedor</Label>
                    <Input value={productForm.supplier_name} onChange={(event) => updateProductForm('supplier_name', event.target.value)} placeholder="Ex: Distribuidora X" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Código de barras</Label>
                    <Input value={productForm.barcode} onChange={(event) => updateProductForm('barcode', event.target.value)} placeholder="Ex: 789..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Estoque</Label>
                      <Input type="number" value={productForm.stock} onChange={(event) => updateProductForm('stock', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Estoque mínimo</Label>
                      <Input type="number" value={productForm.min_stock} onChange={(event) => updateProductForm('min_stock', event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Custos do produto</h3>
                    {selectedCategoryRule && (
                      <Button type="button" variant="outline" size="sm" onClick={applyRuleToCurrentProduct}>
                        Aplicar regra da categoria
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Custo de compra</Label>
                      <Input type="number" step="0.01" value={productForm.purchase_cost} onChange={(event) => updateProductForm('purchase_cost', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Frete</Label>
                      <Input type="number" step="0.01" value={productForm.freight_cost} onChange={(event) => updateProductForm('freight_cost', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Imposto</Label>
                      <Input type="number" step="0.01" value={productForm.tax_cost} onChange={(event) => updateProductForm('tax_cost', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Comissão</Label>
                      <Input type="number" step="0.01" value={productForm.commission_cost} onChange={(event) => updateProductForm('commission_cost', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Taxa de cartão</Label>
                      <Input type="number" step="0.01" value={productForm.card_fee_cost} onChange={(event) => updateProductForm('card_fee_cost', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Embalagem</Label>
                      <Input type="number" step="0.01" value={productForm.packaging_cost} onChange={(event) => updateProductForm('packaging_cost', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Custo operacional</Label>
                      <Input type="number" step="0.01" value={productForm.operational_cost} onChange={(event) => updateProductForm('operational_cost', event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Outros custos</Label>
                      <Input type="number" step="0.01" value={productForm.other_extra_cost} onChange={(event) => updateProductForm('other_extra_cost', event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Preço de venda</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onChange={(event) => {
                        setProductSyncMode('price');
                        setProductForm((current) => {
                          const next = { ...current, price: event.target.value };
                          return syncProductWithMode(next, 'price');
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Markup alvo (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={productForm.target_markup_pct}
                      onChange={(event) => {
                        setProductSyncMode('markup');
                        setProductForm((current) => syncProductWithMode({ ...current, target_markup_pct: event.target.value }, 'markup'));
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Markup mínimo (%)</Label>
                    <Input type="number" step="0.01" value={productForm.minimum_markup_pct} onChange={(event) => updateProductForm('minimum_markup_pct', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço mínimo</Label>
                    <Input type="number" step="0.01" value={productForm.minimum_price} onChange={(event) => updateProductForm('minimum_price', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Arredondamento</Label>
                    <Select value={productForm.rounding_rule} onValueChange={(value) => updateProductForm('rounding_rule', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICING_ROUNDING_RULES.map((rule) => (
                          <SelectItem key={rule} value={rule}>
                            {pricingRoundingLabels[rule]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Observações de precificação</Label>
                    <Textarea value={productForm.pricing_notes} onChange={(event) => updateProductForm('pricing_notes', event.target.value)} placeholder="Anote limites, promoções e observações operacionais." />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {previewBelowCost && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Preço abaixo do custo</AlertTitle>
                    <AlertDescription>
                      O produto não pode ser salvo com preço de venda menor que o custo real.
                    </AlertDescription>
                  </Alert>
                )}
                {previewLowMargin && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Margem muito baixa</AlertTitle>
                    <AlertDescription>
                      A margem atual está em {formatPercent(previewMargin)}. Revise antes de confirmar.
                    </AlertDescription>
                  </Alert>
                )}
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Resumo instantâneo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Custo real</span><strong>{formatMoney(previewRealCost)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Custos extras</span><strong>{formatMoney(getTotalExtraCosts(productPreview))}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Preço atual</span><strong>{formatMoney(productPreview.price ?? 0)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Preço sugerido</span><strong className="text-primary">{formatMoney(previewSuggestedPrice)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Markup</span><strong>{formatPercent(previewMarkup)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Margem</span><strong>{formatPercent(previewMargin)}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Lucro por unidade</span><strong>{formatMoney(previewProfit)}</strong></div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Regra da categoria</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {selectedCategoryRule ? (
                      <>
                        <div className="flex justify-between"><span className="text-muted-foreground">Categoria</span><strong>{selectedCategoryRule.category}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Markup padrão</span><strong>{formatPercent(selectedCategoryRule.default_markup_pct)}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Markup mínimo</span><strong>{formatPercent(selectedCategoryRule.minimum_markup_pct)}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Preço mínimo</span><strong>{formatMoney(selectedCategoryRule.minimum_price)}</strong></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Arredondamento</span><strong>{pricingRoundingLabels[selectedCategoryRule.rounding_rule]}</strong></div>
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        Essa categoria ainda não tem regra. Você pode cadastrar na aba <strong>Regras</strong>.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleProductSave}>
                <Save className="mr-2 h-4 w-4" />
                {productForm.id ? 'Salvar precificação' : 'Cadastrar produto'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={managerApprovalDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetManagerApprovalState();
            return;
          }
          setManagerApprovalDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovação do gerente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mudanças de preço, custo e markup exigem confirmação do administrador da loja.
            </p>
            <div className="space-y-1.5">
              <Label>Login do gerente</Label>
              <Input
                type="email"
                value={managerEmail}
                onChange={(event) => setManagerEmail(event.target.value)}
                placeholder="admin@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha do gerente</Label>
              <PasswordInput
                value={managerPassword}
                onChange={(event) => setManagerPassword(event.target.value)}
                placeholder="Digite a senha"
              />
            </div>
            {managerApprovalError && (
              <Alert variant="destructive">
                <AlertTitle>Não foi possível aprovar</AlertTitle>
                <AlertDescription>{managerApprovalError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetManagerApprovalState} disabled={managerApprovalLoading}>
              Cancelar
            </Button>
            <Button onClick={() => void handleManagerApproval()} disabled={managerApprovalLoading}>
              {managerApprovalLoading ? 'Validando...' : 'Aprovar alteração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Produtos monitorados', value: pricingRows.length, icon: Package },
          { label: 'Abaixo do ideal', value: belowIdealCount, icon: AlertTriangle },
          { label: 'Margem média atual', value: formatPercent(averageMargin), icon: TrendingUp },
          { label: 'Regras ativas', value: pricingRules.length, icon: Sparkles },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="produtos" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 p-1 md:grid-cols-5">
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4">
          <Card className="border-border/60">
            <CardContent className="space-y-4 p-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por nome, categoria, fornecedor ou código" />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Custo real</TableHead>
                    <TableHead>Preço atual</TableHead>
                    <TableHead>Markup</TableHead>
                    <TableHead>Margem</TableHead>
                    <TableHead>Lucro un.</TableHead>
                    <TableHead>Sugerido</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingRows.map((row) => (
                    <TableRow key={row.product.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{row.product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.product.category || 'Sem categoria'}
                            {row.product.supplier_name ? ` • ${row.product.supplier_name}` : ''}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{formatMoney(row.realCost)}</p>
                          {row.extraCosts > 0 && <p className="text-xs text-muted-foreground">Extras {formatMoney(row.extraCosts)}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{formatMoney(row.product.price)}</TableCell>
                      <TableCell>{formatPercent(row.markup)}</TableCell>
                      <TableCell>{formatPercent(row.margin)}</TableCell>
                      <TableCell>{formatMoney(row.unitProfit)}</TableCell>
                      <TableCell className="font-medium text-primary">{formatMoney(row.suggestedPrice)}</TableCell>
                      <TableCell>{row.product.stock}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {row.belowIdeal ? (
                            <Badge variant="destructive">Ajustar</Badge>
                          ) : (
                            <Badge variant="secondary">OK</Badge>
                          )}
                          {row.margin > 0 && row.margin < LOW_MARGIN_WARNING_PCT && (
                            <Badge variant="outline">Margem baixa</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(row.product)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button size="sm" onClick={() => void applySuggestedPriceToProduct(row.product)}>
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                            Aplicar sugerido
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pricingRows.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado para esse filtro.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>Regra por categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Input value={ruleForm.category} onChange={(event) => setRuleForm((current) => ({ ...current, category: event.target.value }))} placeholder="Ex: Bebidas" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Markup padrão (%)</Label>
                    <Input type="number" step="0.01" value={ruleForm.default_markup_pct} onChange={(event) => setRuleForm((current) => ({ ...current, default_markup_pct: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Markup mínimo (%)</Label>
                    <Input type="number" step="0.01" value={ruleForm.minimum_markup_pct} onChange={(event) => setRuleForm((current) => ({ ...current, minimum_markup_pct: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço mínimo</Label>
                    <Input type="number" step="0.01" value={ruleForm.minimum_price} onChange={(event) => setRuleForm((current) => ({ ...current, minimum_price: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Arredondamento</Label>
                    <Select value={ruleForm.rounding_rule} onValueChange={(value) => setRuleForm((current) => ({ ...current, rounding_rule: normalizePricingRoundingRule(value) }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICING_ROUNDING_RULES.map((rule) => (
                          <SelectItem key={rule} value={rule}>
                            {pricingRoundingLabels[rule]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea value={ruleForm.notes} onChange={(event) => setRuleForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ex: categoria com imposto variável ou preço controlado." />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void handleRuleSave()}>
                    <Save className="mr-2 h-4 w-4" />
                    {ruleForm.id ? 'Atualizar regra' : 'Salvar regra'}
                  </Button>
                  {ruleForm.id && (
                    <Button variant="outline" onClick={resetRuleForm}>
                      Limpar edição
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>Regras cadastradas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pricingRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada ainda.</p>
                ) : (
                  pricingRules.map((rule) => (
                    <div key={rule.id} className="rounded-xl border border-border/60 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{rule.category}</p>
                          <p className="text-sm text-muted-foreground">
                            Markup padrão {formatPercent(rule.default_markup_pct)} • mínimo {formatPercent(rule.minimum_markup_pct)} • piso {formatMoney(rule.minimum_price)}
                          </p>
                          <p className="text-xs text-muted-foreground">{pricingRoundingLabels[rule.rounding_rule]}</p>
                          {rule.notes && <p className="text-xs text-muted-foreground">{rule.notes}</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setRuleForm(ruleToForm(rule))}>
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => void handleDeleteRule(rule)}>
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="simulador" className="space-y-4">
          {simulatorDiscountKillsProfit && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Esse desconto mata o lucro</AlertTitle>
              <AlertDescription>
                Com o desconto informado, o lucro estimado fica em {formatMoney(simulatorNetProfit)}.
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Simulador de preço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Custo de compra</Label>
                    <Input type="number" step="0.01" value={simulatorForm.purchase_cost} onChange={(event) => updateSimulatorForm('purchase_cost', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Frete</Label>
                    <Input type="number" step="0.01" value={simulatorForm.freight_cost} onChange={(event) => updateSimulatorForm('freight_cost', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Imposto</Label>
                    <Input type="number" step="0.01" value={simulatorForm.tax_cost} onChange={(event) => updateSimulatorForm('tax_cost', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Comissão</Label>
                    <Input type="number" step="0.01" value={simulatorForm.commission_cost} onChange={(event) => updateSimulatorForm('commission_cost', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Taxa de cartão</Label>
                    <Input type="number" step="0.01" value={simulatorForm.card_fee_cost} onChange={(event) => updateSimulatorForm('card_fee_cost', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Embalagem</Label>
                    <Input type="number" step="0.01" value={simulatorForm.packaging_cost} onChange={(event) => updateSimulatorForm('packaging_cost', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Custo operacional</Label>
                    <Input type="number" step="0.01" value={simulatorForm.operational_cost} onChange={(event) => updateSimulatorForm('operational_cost', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Outros custos</Label>
                    <Input type="number" step="0.01" value={simulatorForm.other_extra_cost} onChange={(event) => updateSimulatorForm('other_extra_cost', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço final</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={simulatorForm.price}
                      onChange={(event) => {
                        setSimulatorSyncMode('price');
                        setSimulatorForm((current) => {
                          const next = { ...current, price: event.target.value };
                          const realCost = getRealCost(simulatorToProductLike(next));
                          return {
                            ...next,
                            target_markup_pct: realCost > 0 ? String(getMarkupFromPrice(realCost, toNumber(next.price))) : '',
                          };
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Markup desejado (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={simulatorForm.target_markup_pct}
                      onChange={(event) => {
                        setSimulatorSyncMode('markup');
                        setSimulatorForm((current) => {
                          const next = { ...current, target_markup_pct: event.target.value };
                          const realCost = getRealCost(simulatorToProductLike(next));
                          const price = applyPricingRounding(realCost * (1 + toNumber(next.target_markup_pct) / 100), next.rounding_rule);
                          return { ...next, price: price > 0 ? String(price) : '' };
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Desconto simulado</Label>
                    <Input type="number" step="0.01" value={simulatorForm.discount_amount} onChange={(event) => updateSimulatorForm('discount_amount', event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Arredondamento</Label>
                    <Select value={simulatorForm.rounding_rule} onValueChange={(value) => updateSimulatorForm('rounding_rule', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICING_ROUNDING_RULES.map((rule) => (
                          <SelectItem key={rule} value={rule}>
                            {pricingRoundingLabels[rule]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Custo real', value: formatMoney(simulatorRealCost), icon: Wallet },
                { label: 'Preço sugerido', value: formatMoney(simulatorSuggestedPrice), icon: Sparkles },
                { label: 'Lucro bruto', value: formatMoney(simulatorGrossProfit), icon: TrendingUp },
                { label: 'Margem bruta', value: formatPercent(simulatorMargin), icon: BarChart3 },
                { label: 'Lucro líquido estimado', value: formatMoney(simulatorNetProfit), icon: TrendingDown },
                { label: 'Margem após desconto', value: formatPercent(simulatorDiscountMargin), icon: AlertTriangle },
              ].map((card) => (
                <Card key={card.label} className="border-border/60">
                  <CardContent className="flex h-full items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-xl font-bold">{card.value}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <card.icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analise" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/60">
              <CardContent className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Descontos concedidos</p>
                <p className="text-2xl font-bold">{formatMoney(totalDiscountImpact)}</p>
                <p className="text-sm text-muted-foreground">Impacto total registrado nos itens vendidos.</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Lucro antes dos descontos</p>
                <p className="text-2xl font-bold">{formatMoney(grossProfitBeforeDiscount)}</p>
                <p className="text-sm text-muted-foreground">Cenário bruto considerando os preços sem abatimento.</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="space-y-2 p-4">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Lucro após descontos</p>
                <p className="text-2xl font-bold">{formatMoney(grossProfitAfterDiscount)}</p>
                <p className="text-sm text-muted-foreground">Resultado real da operação com desconto aplicado.</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Produtos com maior lucro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profitByProduct.slice(0, 6).map((item) => (
                  <div key={item.name} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.quantity} unidades vendidas</p>
                    </div>
                    <strong>{formatMoney(item.profit)}</strong>
                  </div>
                ))}
                {profitByProduct.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há vendas para analisar.</p>}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Produtos abaixo do ideal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pricingRows.filter((row) => row.belowIdeal).slice(0, 6).map((row) => (
                  <div key={row.product.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{row.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Atual {formatPercent(row.markup)} • ideal {formatPercent(row.idealMarkup)}
                      </p>
                    </div>
                    <Badge variant="destructive">Ajustar</Badge>
                  </div>
                ))}
                {pricingRows.filter((row) => row.belowIdeal).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum produto abaixo da regra mínima.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Menor margem atual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pricingRows.slice().sort((a, b) => a.margin - b.margin).slice(0, 6).map((row) => (
                  <div key={row.product.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{row.product.name}</p>
                      <p className="text-xs text-muted-foreground">{row.product.category || 'Sem categoria'}</p>
                    </div>
                    <strong>{formatPercent(row.margin)}</strong>
                  </div>
                ))}
                {pricingRows.length === 0 && <p className="text-sm text-muted-foreground">Cadastre produtos para acompanhar margem.</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Lucro por categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryProfit.slice(0, 8).map((item) => (
                  <div key={item.category} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{item.category}</p>
                      <p className="text-xs text-muted-foreground">Receita {formatMoney(item.revenue)}</p>
                    </div>
                    <strong>{formatMoney(item.profit)}</strong>
                  </div>
                ))}
                {categoryProfit.length === 0 && <p className="text-sm text-muted-foreground">As vendas começarão a alimentar esse quadro automaticamente.</p>}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Lucro por operador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {operatorProfit.slice(0, 8).map((item) => (
                  <div key={item.name} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Receita {formatMoney(item.revenue)}</p>
                    </div>
                    <strong>{formatMoney(item.profit)}</strong>
                  </div>
                ))}
                {operatorProfit.length === 0 && <p className="text-sm text-muted-foreground">Sem dados suficientes por operador ainda.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle>Histórico de alteração de preço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Filtrar histórico por produto" />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Markup</TableHead>
                    <TableHead>Margem</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPriceHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.product_name}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p>{formatMoney(entry.previous_price)} → {formatMoney(entry.new_price)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatMoney(entry.previous_cost_price)} → {formatMoney(entry.new_cost_price)}</TableCell>
                      <TableCell>{formatPercent(entry.previous_markup_pct)} → {formatPercent(entry.new_markup_pct)}</TableCell>
                      <TableCell>{formatPercent(entry.previous_margin_pct)} → {formatPercent(entry.new_margin_pct)}</TableCell>
                      <TableCell>{new Date(entry.created_at).toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredPriceHistory.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma alteração de preço registrada ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
