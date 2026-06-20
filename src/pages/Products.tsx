import { useState } from 'react';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Plus, Search, Edit, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/types';
import { canManageProducts } from '@/lib/access';
import { getMarginPercent, getMarkupPercent, getPriceFromMarkup, getUnitProfit } from '@/lib/pricing';
import { verifyPricingManagerApproval } from '@/lib/pricingManagerApproval';
import { parseDecimalInput } from '@/lib/numberInput';
import { filterProductsBySearch, toProductUppercase } from '@/lib/productSearch';
import { supabase } from '@/integrations/supabase/client';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';

const LOW_MARGIN_WARNING_PCT = 15;

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useData();
  const { role, session, user, ownerUserId } = useAuth();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [category, setCategory] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [expirationQuantity, setExpirationQuantity] = useState('');
  const [expirationAlertDays, setExpirationAlertDays] = useState('30');
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalEmail, setApprovalEmail] = useState('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ id: string; data: Partial<Product> } | null>(null);
  const readOnly = !canManageProducts(role);

  const activeProducts = products.filter(p => !p.deleted);
  const filtered = filterProductsBySearch(activeProducts, search);

  const numericPrice = parseDecimalInput(price);
  const numericCostPrice = parseDecimalInput(costPrice);
  const previewMarkup = numericCostPrice > 0 ? getMarkupPercent(numericPrice, numericCostPrice) : 0;
  const previewMargin = numericPrice > 0 ? getMarginPercent(numericPrice, numericCostPrice) : 0;
  const priceBelowCost = numericPrice > 0 && numericPrice < numericCostPrice;
  const lowMargin = !priceBelowCost && previewMargin > 0 && previewMargin < LOW_MARGIN_WARNING_PCT;

  const resetApprovalState = () => {
    setApprovalDialogOpen(false);
    setApprovalEmail('');
    setApprovalPassword('');
    setApprovalError('');
    setApprovalLoading(false);
    setPendingSave(null);
  };

  const persistSave = async (targetEditId: string | null, data: Partial<Product>) => {
    if (targetEditId) {
      try {
        await updateProduct(targetEditId, data);
        toast.success('Produto atualizado!');
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
        toast.success('Produto cadastrado!');
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
    const data: Partial<Product> = {
      name: name.trim(),
      price: parseDecimalInput(price),
      cost_price: parseDecimalInput(costPrice),
      category: category.trim(),
      supplier_name: supplierName.trim(),
      barcode: barcode.trim(),
      stock: parseInt(stock) || 0,
      min_stock: parseInt(minStock) || 0,
    };

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
    if (!session?.access_token) {
      setApprovalError('Sua sessão expirou. Faça login novamente.');
      return;
    }

    if (!pendingSave) {
      setApprovalError('Nenhuma alteração pendente para aprovar.');
      return;
    }

    if (!approvalEmail.trim() || !approvalPassword.trim()) {
      setApprovalError('Informe login e senha do gerente.');
      return;
    }

    setApprovalLoading(true);
    setApprovalError('');

    const result = await verifyPricingManagerApproval(
      session.access_token,
      approvalEmail,
      approvalPassword,
    );

    setApprovalLoading(false);

    if (!result.success) {
      setApprovalError(result.error || 'Não foi possível validar a aprovação.');
      return;
    }

    await persistSave(pendingSave.id, pendingSave.data);
    resetApprovalState();
  };

  const resetForm = () => { setName(''); setPrice(''); setCostPrice(''); setCategory(''); setSupplierName(''); setBarcode(''); setStock(''); setMinStock(''); setBatchCode(''); setExpirationDate(''); setExpirationQuantity(''); setExpirationAlertDays('30'); setEditId(null); setOpen(false); resetApprovalState(); };

  const openEdit = (p: Product) => {
    setEditId(p.id); setName(toProductUppercase(p.name)); setPrice(p.price.toString());
    setCostPrice((p.cost_price || 0).toString()); setCategory(toProductUppercase(p.category)); setSupplierName(toProductUppercase(p.supplier_name || ''));
    setBarcode(toProductUppercase(p.barcode || '')); setStock((p.stock || 0).toString()); setMinStock((p.min_stock || 0).toString());
    resetApprovalState();
    setOpen(true);
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
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? 'Editar Produto' : 'Cadastrar Produto'}</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-auto">
                <div className="space-y-1"><Label>Nome / Marca</Label><Input value={name} onChange={e => setName(toProductUppercase(e.target.value))} placeholder="Ex: Skol 600ml" /></div>
                <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1"><Label>Código de Barras</Label><Input value={barcode} onChange={e => setBarcode(toProductUppercase(e.target.value))} placeholder="Ex: 7891234567890" /></div>
                <div className="space-y-1"><Label>Categoria</Label><Input value={category} onChange={e => setCategory(toProductUppercase(e.target.value))} placeholder="Ex: Cerveja, Cigarro" /></div>
                <div className="space-y-1"><Label>Fornecedor</Label><Input value={supplierName} onChange={e => setSupplierName(toProductUppercase(e.target.value))} placeholder="Ex: Distribuidora Norte" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Estoque</Label><Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" /></div>
                  <div className="space-y-1"><Label>Estoque Mínimo</Label><Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="0" /></div>
                </div>
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
              <DialogFooter><Button onClick={handleSave} className="w-full sm:w-auto">{editId ? 'Salvar' : 'Cadastrar'}</Button></DialogFooter>
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
            <DialogTitle>Aprovação do gerente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Alterações de preço ou custo exigem confirmação do administrador da loja.
            </p>
            <div className="space-y-1">
              <Label>Login do gerente</Label>
              <Input type="email" value={approvalEmail} onChange={e => setApprovalEmail(e.target.value)} placeholder="admin@empresa.com" />
            </div>
            <div className="space-y-1">
              <Label>Senha do gerente</Label>
              <PasswordInput value={approvalPassword} onChange={e => setApprovalPassword(e.target.value)} placeholder="Digite a senha" />
            </div>
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
              {approvalLoading ? 'Validando...' : 'Aprovar alteração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative mb-4" data-tour-id="products-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(toProductUppercase(e.target.value))} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-tour-id="products-list">
        {filtered.map(p => {
          const markup = getMarkupPercent(p.price, p.cost_price);
          const margin = getMarginPercent(p.price, p.cost_price);
          const unitProfit = getUnitProfit(p.price, p.cost_price);
          return (
            <motion.div key={p.id} whileHover={{ scale: 1.02 }}>
              <Card className={`border-border/50 ${p.stock <= p.min_stock && p.min_stock > 0 ? 'border-destructive/30' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2 min-w-0">
                    <div className="min-w-0 mr-2">
                      <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                    <span className="text-xs text-muted-foreground">{p.code ? `#${p.code}` : 'Sem código'}{p.category ? ` - ${p.category}` : ''}</span>
                    {p.supplier_name && <p className="text-[11px] text-muted-foreground truncate">Fornecedor: {p.supplier_name}</p>}
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
