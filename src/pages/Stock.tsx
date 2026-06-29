import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Search, Plus, AlertTriangle, Package, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '../../shared/locale/format';
import { getRedactedLogValue } from '../../shared/security/redaction';
import { filterProductsBySearch, toProductUppercase } from '@/lib/productSearch';
import { buildLowStockPurchaseSuggestion, type PurchaseSuggestion } from '@/lib/managementInsights';
import { useProductBatches } from '@/hooks/useProductBatches';
import {
  calculateStockMovement,
  getStockMovementDirection,
  STOCK_MOVEMENT_REASONS,
  type StockMovementType,
} from '@/lib/stockMovement';
import { formatProductCode } from '@/lib/productCode';
import { getLocalIsoDate } from '@/lib/clientDebtDueDate';

export default function Stock() {
  const { products, stockMovements, addStockMovement, clearAllStock } = useData();
  const { user } = useAuth();
  const { batches } = useProductBatches();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [movementProductSearch, setMovementProductSearch] = useState('');
  const [movType, setMovType] = useState<StockMovementType>('entrada');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [reasonNotes, setReasonNotes] = useState('');
  const [savingMovement, setSavingMovement] = useState(false);
  const [clearingStock, setClearingStock] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState('');
  const [movementHistorySearch, setMovementHistorySearch] = useState('');
  const [movementHistoryType, setMovementHistoryType] = useState('all');
  const [movementDateFrom, setMovementDateFrom] = useState('');
  const [movementDateTo, setMovementDateTo] = useState('');

  const activeProducts = products.filter(p => !p.deleted);
  const nextBatchByProductId = useMemo(() => {
    const result = new Map<string, (typeof batches)[number]>();
    batches.forEach((batch) => {
      if (batch.product_id && !result.has(batch.product_id)) result.set(batch.product_id, batch);
    });
    return result;
  }, [batches]);
  const visibleProducts = products.filter(p => !p.deleted || nextBatchByProductId.has(p.id));
  const todayKey = getLocalIsoDate();
  const expiringProductIds = new Set(batches
    .filter((batch) => {
      const expiration = new Date(`${batch.expiration_date}T00:00:00`).getTime();
      const current = new Date(`${todayKey}T00:00:00`).getTime();
      const remainingDays = Math.ceil((expiration - current) / 86400000);
      return remainingDays <= Number(batch.alert_days ?? 30);
    })
    .map((batch) => batch.product_id)
    .filter(Boolean));
  const expiringProducts = visibleProducts.filter((product) => expiringProductIds.has(product.id));
  const lowStock = activeProducts.filter(p => p.stock <= p.min_stock && p.min_stock > 0);
  const filtered = [...filterProductsBySearch(visibleProducts, search)].sort((left, right) => {
    const leftExpiring = expiringProductIds.has(left.id);
    const rightExpiring = expiringProductIds.has(right.id);
    if (leftExpiring !== rightExpiring) return leftExpiring ? -1 : 1;
    const leftLow = left.min_stock > 0 && left.stock <= left.min_stock;
    const rightLow = right.min_stock > 0 && right.stock <= right.min_stock;
    if (leftLow !== rightLow) return leftLow ? -1 : 1;
    if (leftExpiring && rightExpiring) {
      return String(nextBatchByProductId.get(left.id)?.expiration_date).localeCompare(String(nextBatchByProductId.get(right.id)?.expiration_date));
    }
    return left.name.localeCompare(right.name, 'pt-BR');
  });
  const purchaseSuggestions = activeProducts
    .map(buildLowStockPurchaseSuggestion)
    .filter((suggestion): suggestion is PurchaseSuggestion => Boolean(suggestion))
    .sort((left, right) => (left.severity === right.severity ? right.suggestedQuantity - left.suggestedQuantity : left.severity === 'critical' ? -1 : 1));
  const hasStockToClear = activeProducts.some(product => product.stock > 0);
  const selectedProductRecord = activeProducts.find(product => product.id === selectedProduct) ?? null;
  const movementProductResults = filterProductsBySearch(activeProducts, movementProductSearch).slice(0, 8);
  const parsedMovementQuantity = Number(qty.replace(',', '.'));
  const movementPreview = useMemo(() => {
    if (!selectedProductRecord || qty.trim() === '') return null;
    try {
      return calculateStockMovement(selectedProductRecord.stock, movType, parsedMovementQuantity);
    } catch {
      return null;
    }
  }, [movType, parsedMovementQuantity, qty, selectedProductRecord]);
  const filteredMovements = stockMovements.filter((movement) => {
    const product = products.find(item => item.id === movement.product_id);
    const matchesProduct = !movementHistorySearch.trim()
      || filterProductsBySearch(product ? [product] : [], movementHistorySearch).length > 0;
    const direction = getStockMovementDirection(movement);
    const movementDate = movement.date.slice(0, 10);
    const matchesDate = (!movementDateFrom || movementDate >= movementDateFrom) && (!movementDateTo || movementDate <= movementDateTo);
    return matchesProduct && matchesDate && (movementHistoryType === 'all' || movementHistoryType === direction || movementHistoryType === movement.type);
  });

  const openPurchaseOrder = (suggestion: PurchaseSuggestion) => {
    const params = new URLSearchParams({
      tab: 'compras',
      product: suggestion.productId,
      quantity: String(suggestion.suggestedQuantity),
      supplier: suggestion.supplierName,
    });
    navigate(`/operacoes?${params.toString()}`);
  };

  const handleSave = async () => {
    if (!selectedProduct || !qty || !reason) { toast.error('Preencha produto, quantidade e motivo'); return; }
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;
    try {
      calculateStockMovement(product.stock, movType, parsedMovementQuantity);
      setSavingMovement(true);
      const fullReason = reasonNotes.trim() ? `${reason} - ${reasonNotes.trim()}` : reason;
      await addStockMovement(selectedProduct, movType, parsedMovementQuantity, fullReason, { source: 'manual' });
      setSelectedProduct('');
      setMovementProductSearch('');
      setQty('');
      setReason('');
      setReasonNotes('');
      setOpen(false);
      toast.success('Movimentação registrada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível movimentar o estoque.');
    } finally {
      setSavingMovement(false);
    }
  };

  const handleClearStock = async () => {
    try {
      setClearingStock(true);
      await clearAllStock('Limpeza geral de estoque');
      toast.success('Estoque zerado!');
      setClearConfirmation('');
    } catch (error) {
      console.error('Erro ao limpar estoque:', getRedactedLogValue(error));
      toast.error('Não foi possível limpar o estoque');
    } finally {
      setClearingStock(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between" data-tour-id="stock-header">
        <h1 className="text-xl font-bold">📦 Estoque</h1>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={!hasStockToClear || clearingStock}>
                Limpar estoque
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Zerar todo o estoque?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os produtos com saldo em estoque serão ajustados para zero. Essa ação deve ser usada com cuidado.
                </AlertDialogDescription>
                <div className="space-y-2 py-2">
                  <Label>Digite ZERAR ESTOQUE para confirmar</Label>
                  <Input value={clearConfirmation} onChange={event => setClearConfirmation(toProductUppercase(event.target.value))} />
                </div>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setClearConfirmation('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearStock} disabled={clearConfirmation !== 'ZERAR ESTOQUE' || clearingStock}>
                  Confirmar limpeza
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={open} onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              setSelectedProduct('');
              setMovementProductSearch('');
              setQty('');
              setReason('');
              setReasonNotes('');
            }
          }}>
            <DialogTrigger asChild><Button size="sm" data-tour-id="stock-move"><Plus className="h-4 w-4 mr-1" />Movimentar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Movimentação de Estoque</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Buscar produto</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={movementProductSearch}
                      onChange={event => {
                        setMovementProductSearch(toProductUppercase(event.target.value));
                        setSelectedProduct('');
                      }}
                      placeholder="Nome, código ou código de barras"
                      autoFocus
                    />
                  </div>
                  {!selectedProductRecord && (
                    <div className="max-h-48 overflow-y-auto rounded-md border">
                      {movementProductResults.map(product => (
                        <button
                          key={product.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                          onClick={() => {
                            setSelectedProduct(product.id);
                            setMovementProductSearch(product.name);
                          }}
                        >
                          <span className="min-w-0 truncate">{product.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatProductCode(product.code) || product.barcode || 'Sem código'} · saldo {product.stock}</span>
                        </button>
                      ))}
                      {movementProductResults.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
                    </div>
                  )}
                  {selectedProductRecord && (
                    <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                      <div className="min-w-0"><p className="truncate font-medium">{selectedProductRecord.name}</p><p className="text-xs text-muted-foreground">Estoque atual: {selectedProductRecord.stock}</p></div>
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={movType} onValueChange={(value: StockMovementType) => {
                    setMovType(value);
                    setReason('');
                    setQty('');
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">📥 Entrada</SelectItem>
                      <SelectItem value="saida">📤 Saída</SelectItem>
                      <SelectItem value="ajuste">🔧 Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{movType === 'ajuste' ? 'Novo saldo contado' : 'Quantidade'}</Label>
                  <Input type="number" min="0" step="0.001" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label>Motivo</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger><SelectValue placeholder="Escolha o motivo" /></SelectTrigger>
                    <SelectContent>{STOCK_MOVEMENT_REASONS[movType].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Observação</Label><Input value={reasonNotes} onChange={e => setReasonNotes(e.target.value)} placeholder="Opcional" /></div>
                {selectedProductRecord && movementPreview && (
                  <div className="flex items-center justify-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                    <span>Saldo {movementPreview.balanceBefore}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-primary">Saldo {movementPreview.balanceAfter}</span>
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={handleSave} disabled={!movementPreview || !reason || savingMovement}>{savingMovement ? 'Salvando...' : 'Confirmar'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {expiringProducts.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="px-4 pb-2 pt-3"><CardTitle className="flex items-center gap-2 text-sm text-amber-600"><CalendarClock className="h-4 w-4" />Validade próxima ou vencida</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {expiringProducts.map((product) => {
                const batch = nextBatchByProductId.get(product.id);
                return <p key={product.id} className="text-xs"><span className="font-medium">{formatProductCode(product.code) || product.barcode || 'Sem código'} · {product.name}</span> · {batch ? new Date(`${batch.expiration_date}T12:00:00`).toLocaleDateString('pt-BR') : '-'}</p>;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5" data-tour-id="stock-low">
          <CardHeader className="pb-2 px-4 pt-3"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Estoque Baixo</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {lowStock.map(p => (
                <p key={p.id} className="text-xs">⚠️ <span className="font-medium">{p.name}</span> — {p.stock} un (mínimo: {p.min_stock})</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {purchaseSuggestions.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2 px-4 pt-3">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <Package className="h-4 w-4" />
              Sugestão de compra
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid gap-2 md:grid-cols-2">
              {purchaseSuggestions.slice(0, 8).map((suggestion) => (
                <div key={suggestion.productId} className="flex items-center justify-between gap-3 rounded-md border bg-background/80 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{suggestion.productName}</p>
                      <Badge variant={suggestion.severity === 'critical' ? 'destructive' : 'secondary'} className="shrink-0">
                        {suggestion.severity === 'critical' ? 'Zerado' : 'Baixo'}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Atual {suggestion.currentStock} / mín. {suggestion.minStock} · {suggestion.supplierName}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => openPurchaseOrder(suggestion)}>
                    Pedir {suggestion.suggestedQuantity}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative" data-tour-id="stock-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(toProductUppercase(e.target.value))} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => {
          const nextBatch = nextBatchByProductId.get(p.id);
          return (
          <Card key={p.id} className={`border-border/50 ${expiringProductIds.has(p.id) ? 'border-amber-500/60' : p.stock <= p.min_stock && p.min_stock > 0 ? 'border-destructive/50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 mr-2">
                  <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                  {p.deleted && <Badge variant="destructive" className="mt-1">Arquivado com lote monitorado</Badge>}
                  {p.category && <span className="text-xs text-muted-foreground">{p.category}</span>}
                </div>
                <div className="text-right">
                  <p className="text-primary font-bold text-sm">R$ {p.price.toFixed(2)}</p>
                </div>
              </div>
              {p.supplier_name && <p className="mb-2 truncate text-xs text-muted-foreground">Fornecedor: {p.supplier_name}</p>}
              <div className="flex justify-between text-xs">
                <span className={p.stock <= p.min_stock && p.min_stock > 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                  <Package className="h-3 w-3 inline mr-1" />Estoque: {p.stock}
                </span>
                <span className="text-muted-foreground">Mín: {p.min_stock}</span>
              </div>
              {nextBatch && (
                <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Validade: {new Date(`${nextBatch.expiration_date}T12:00:00`).toLocaleDateString('pt-BR')} · lote {nextBatch.batch_code || 'não informado'}
                </p>
              )}
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Recent movements */}
      <Card className="border-border/50" data-tour-id="stock-movements">
        <CardHeader><CardTitle className="text-sm">Movimentações Recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_150px_150px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Filtrar por produto" value={movementHistorySearch} onChange={event => setMovementHistorySearch(toProductUppercase(event.target.value))} />
            </div>
            <Select value={movementHistoryType} onValueChange={setMovementHistoryType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
                <SelectItem value="ajuste">Ajustes</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={movementDateFrom} onChange={event => setMovementDateFrom(event.target.value)} aria-label="Movimentações a partir de" />
            <Input type="date" value={movementDateTo} onChange={event => setMovementDateTo(event.target.value)} aria-label="Movimentações até" />
          </div>
          {filteredMovements.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma movimentação encontrada</p> : (
            <div className="space-y-2">
              {filteredMovements.slice(0, 50).map(m => {
                const product = products.find(p => p.id === m.product_id);
                const direction = getStockMovementDirection(m);
                return (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium">{product?.name || 'Produto removido'}</p>
                      <p className="truncate text-muted-foreground">{m.source === 'purchase' || /compra/i.test(m.reason) ? 'Compra' : m.source === 'sale' || /venda/i.test(m.reason) ? 'Venda' : 'Manual'} · {m.reason} · {formatDateTime(m.date)}</p>
                      {m.balance_before != null && m.balance_after != null && <p className="text-muted-foreground">Saldo {m.balance_before} → {m.balance_after}</p>}
                    </div>
                    <span className={`ml-3 shrink-0 font-bold ${direction === 'entrada' ? 'text-green-500' : 'text-destructive'}`}>
                      {direction === 'entrada' ? '+' : '-'}{m.quantity}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
