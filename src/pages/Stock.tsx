import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, Check, Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { StockInsightsNavigation } from '@/components/stock/StockInsightsNavigation';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProductBatches } from '@/hooks/useProductBatches';
import { getLocalIsoDate } from '@/lib/clientDebtDueDate';
import { formatProductCode } from '@/lib/productCode';
import { filterProductsBySearch, toProductUppercase } from '@/lib/productSearch';
import { buildNextBatchByProductId, compareProductsByOperationalPriority, getProductPriorityState } from '@/lib/productOperationalPriority';
import { calculateStockMovement, STOCK_MOVEMENT_REASONS, type StockMovementType } from '@/lib/stockMovement';
import { usePaginatedList } from '@/hooks/usePaginatedList';
import { DataPaginationBar } from '@/components/DataPaginationBar';
import { getRedactedLogValue } from '../../shared/security/redaction';

export default function Stock() {
  const { products, addStockMovement, clearAllStock, loading } = useData();
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

  const activeProducts = useMemo(() => products.filter((product) => !product.deleted), [products]);
  const nextBatchByProductId = useMemo(() => buildNextBatchByProductId(batches), [batches]);
  const visibleProducts = products.filter((product) => !product.deleted || nextBatchByProductId.has(product.id));
  const todayKey = getLocalIsoDate();
  const priorityByProductId = useMemo(() => new Map(
    visibleProducts.map((product) => [product.id, getProductPriorityState(product, nextBatchByProductId.get(product.id), todayKey)]),
  ), [nextBatchByProductId, todayKey, visibleProducts]);
  const expiringProducts = visibleProducts.filter((product) => {
    const priority = priorityByProductId.get(product.id);
    return priority?.expired || priority?.expiring;
  });
  const lowStock = activeProducts.filter((product) => priorityByProductId.get(product.id)?.lowStock);
  const filteredProducts = [...filterProductsBySearch(visibleProducts, search)]
    .sort((left, right) => compareProductsByOperationalPriority(left, right, nextBatchByProductId, todayKey));
  const pagination = usePaginatedList(filteredProducts, { pageSize: 24 });
  const hasStockToClear = activeProducts.some((product) => product.stock > 0);
  const selectedProductRecord = activeProducts.find((product) => product.id === selectedProduct) ?? null;
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

  const openProductMovement = (productId: string, productName: string) => {
    setSelectedProduct(productId);
    setMovementProductSearch(productName);
    setMovType('entrada');
    setQty('');
    setReason('');
    setReasonNotes('');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!selectedProduct || !qty || !reason) {
      toast.error('Preencha produto, quantidade e motivo');
      return;
    }

    const product = products.find((item) => item.id === selectedProduct);
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

  if (loading) {
    return <DataRouteLoader label="Carregando estoque..." />;
  }

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
                  <Input value={clearConfirmation} onChange={(event) => setClearConfirmation(toProductUppercase(event.target.value))} />
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
                      onChange={(event) => {
                        setMovementProductSearch(toProductUppercase(event.target.value));
                        setSelectedProduct('');
                      }}
                      placeholder="Nome, código ou código de barras"
                      autoFocus
                    />
                  </div>
                  {!selectedProductRecord && (
                    <div className="max-h-48 overflow-y-auto rounded-md border">
                      {movementProductResults.map((product) => (
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
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatProductCode(product.code) || product.barcode || 'Sem código'} · saldo {product.stock}
                          </span>
                        </button>
                      ))}
                      {movementProductResults.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>}
                    </div>
                  )}
                  {selectedProductRecord && (
                    <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{selectedProductRecord.name}</p>
                        <p className="text-xs text-muted-foreground">Estoque atual: {selectedProductRecord.stock}</p>
                      </div>
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
                  <Input type="number" min="0" step="0.001" value={qty} onChange={(event) => setQty(event.target.value)} placeholder="0" />
                </div>

                <div className="space-y-1">
                  <Label>Motivo</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger><SelectValue placeholder="Escolha o motivo" /></SelectTrigger>
                    <SelectContent>
                      {STOCK_MOVEMENT_REASONS[movType].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Observação</Label>
                  <Input value={reasonNotes} onChange={(event) => setReasonNotes(event.target.value)} placeholder="Opcional" />
                </div>

                {selectedProductRecord && movementPreview && (
                  <div className="flex items-center justify-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                    <span>Saldo {movementPreview.balanceBefore}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-primary">Saldo {movementPreview.balanceAfter}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleSave} disabled={!movementPreview || !reason || savingMovement}>
                  {savingMovement ? 'Salvando...' : 'Confirmar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <StockInsightsNavigation />

      {expiringProducts.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="px-4 pb-2 pt-3">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-600">
              <CalendarClock className="h-4 w-4" />
              Validade próxima ou vencida
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {expiringProducts.map((product) => {
                const priority = priorityByProductId.get(product.id);
                const batch = priority?.batch;
                return (
                  <p key={product.id} className="text-xs">
                    <span className="font-medium">{formatProductCode(product.code) || product.barcode || 'Sem código'} · {product.name}</span>
                    {' · '}
                    {batch ? new Date(`${batch.expiration_date}T12:00:00`).toLocaleDateString('pt-BR') : '-'}
                    {priority?.expired ? ' · vencido' : ''}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {lowStock.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5" data-tour-id="stock-low">
          <CardHeader className="px-4 pb-2 pt-3">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {lowStock.map((product) => (
                <p key={product.id} className="text-xs">
                  ⚠️ <span className="font-medium">{formatProductCode(product.code) || 'Sem código'} · {product.name}</span> — {product.stock} un (mínimo: {product.min_stock})
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative" data-tour-id="stock-search">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={(event) => setSearch(toProductUppercase(event.target.value))} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pagination.pageItems.map((product) => {
          const priority = priorityByProductId.get(product.id) ?? getProductPriorityState(product, nextBatchByProductId.get(product.id), todayKey);
          const nextBatch = priority.batch;
          const borderClass = priority.expired
            ? 'border-destructive/70'
            : priority.expiring
              ? 'border-amber-500/70'
              : priority.lowStock
                ? 'border-destructive/50'
                : priority.hasBatch
                  ? 'border-sky-500/50'
                  : '';

          return (
            <Card
              key={product.id}
              className={`relative overflow-hidden border-border/50 transition-colors hover:border-primary/60 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40 ${borderClass}`}
            >
              <button
                type="button"
                data-tour-id="stock-move"
                className="absolute inset-0 z-10 rounded-lg disabled:cursor-not-allowed"
                disabled={Boolean(product.deleted)}
                onClick={() => openProductMovement(product.id, product.name)}
                aria-label={product.deleted ? `${product.name}: produto arquivado` : `Movimentar estoque de ${product.name}`}
                title={product.deleted ? 'Produto arquivado' : `Movimentar estoque de ${product.name}`}
              />
              <CardContent className="pointer-events-none relative z-0 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div className="mr-2 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatProductCode(product.code) || product.barcode || 'Sem código'}</p>
                    {product.deleted && <Badge variant="destructive" className="mt-1">Arquivado com lote monitorado</Badge>}
                    {priority.expired && <Badge variant="destructive" className="mt-1">Vencido</Badge>}
                    {!priority.expired && priority.expiring && <Badge variant="secondary" className="mt-1">Validade próxima</Badge>}
                    {!priority.expired && !priority.expiring && priority.hasBatch && <Badge variant="outline" className="mt-1">Lote monitorado</Badge>}
                    {product.category && <span className="text-xs text-muted-foreground">{product.category}</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">R$ {product.price.toFixed(2)}</p>
                  </div>
                </div>
                {product.supplier_name && <p className="mb-2 truncate text-xs text-muted-foreground">Fornecedor: {product.supplier_name}</p>}
                <div className="flex justify-between text-xs">
                  <span className={product.stock <= product.min_stock && product.min_stock > 0 ? 'font-bold text-destructive' : 'text-muted-foreground'}>
                    <Package className="mr-1 inline h-3 w-3" />
                    Estoque: {product.stock}
                  </span>
                  <span className="text-muted-foreground">Mín: {product.min_stock}</span>
                  {product.max_stock != null && <span className="text-muted-foreground">Máx: {product.max_stock}</span>}
                </div>
                {nextBatch && (
                  <p className={`mt-2 flex items-center gap-1 text-xs ${priority.expired ? 'text-destructive' : 'text-amber-600'}`}>
                    <CalendarClock className="h-3.5 w-3.5" />
                    Validade: {new Date(`${nextBatch.expiration_date}T12:00:00`).toLocaleDateString('pt-BR')} · lote {nextBatch.batch_code || 'não informado'}
                  </p>
                )}
                <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-center text-xs font-medium text-primary">
                  {product.deleted ? 'Produto arquivado' : 'Movimentar estoque'}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <Card className="border-dashed border-border/70">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado com esse filtro.
          </CardContent>
        </Card>
      )}

      <DataPaginationBar pagination={pagination} />
    </div>
  );
}
