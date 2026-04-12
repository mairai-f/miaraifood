import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function Stock() {
  const { products, stockMovements, addStockMovement, updateProduct, clearAllStock } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [movType, setMovType] = useState('entrada');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [clearingStock, setClearingStock] = useState(false);

  const activeProducts = products.filter(p => !('deleted' in p && (p as any).deleted));
  const filtered = activeProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = activeProducts.filter(p => p.stock <= p.min_stock && p.min_stock > 0);
  const hasStockToClear = activeProducts.some(product => product.stock > 0);

  const handleSave = async () => {
    if (!selectedProduct || !qty) { toast.error('Preencha produto e quantidade'); return; }
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;
    const quantity = parseInt(qty);
    if (isNaN(quantity) || quantity <= 0) { toast.error('Quantidade inválida'); return; }

    await addStockMovement(selectedProduct, movType, quantity, reason.trim());

    // Update product stock
    const newStock = movType === 'entrada' ? product.stock + quantity : Math.max(0, product.stock - quantity);
    await updateProduct(selectedProduct, { stock: newStock } as any);

    setSelectedProduct(''); setQty(''); setReason(''); setOpen(false);
    toast.success(`Estoque ${movType === 'entrada' ? 'adicionado' : 'removido'}!`);
  };

  const handleClearStock = async () => {
    try {
      setClearingStock(true);
      await clearAllStock('Limpeza geral de estoque');
      toast.success('Estoque zerado!');
    } catch (error) {
      console.error('Erro ao limpar estoque:', error);
      toast.error('Não foi possível limpar o estoque');
    } finally {
      setClearingStock(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📦 Estoque</h1>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={!hasStockToClear || clearingStock}>
                Limpar estoque
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Zerar todo o estoque?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os produtos com saldo em estoque serão ajustados para zero. Essa ação deve ser usada com cuidado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearStock}>
                  Confirmar limpeza
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Movimentar</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Movimentação de Estoque</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Produto</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{activeProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (atual: {p.stock})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={movType} onValueChange={setMovType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">📥 Entrada</SelectItem>
                      <SelectItem value="saida">📤 Saída</SelectItem>
                      <SelectItem value="ajuste">🔧 Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Quantidade</Label><Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" /></div>
                <div className="space-y-1"><Label>Motivo</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex: Compra fornecedor" /></div>
              </div>
              <DialogFooter><Button onClick={handleSave}>Confirmar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => (
          <Card key={p.id} className={`border-border/50 ${p.stock <= p.min_stock && p.min_stock > 0 ? 'border-destructive/50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 mr-2">
                  <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                  {p.category && <span className="text-xs text-muted-foreground">{p.category}</span>}
                </div>
                <div className="text-right">
                  <p className="text-primary font-bold text-sm">R$ {p.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className={p.stock <= p.min_stock && p.min_stock > 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                  <Package className="h-3 w-3 inline mr-1" />Estoque: {p.stock}
                </span>
                <span className="text-muted-foreground">Mín: {p.min_stock}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent movements */}
      <Card className="border-border/50">
        <CardHeader><CardTitle className="text-sm">Movimentações Recentes</CardTitle></CardHeader>
        <CardContent>
          {stockMovements.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma movimentação</p> : (
            <div className="space-y-2">
              {stockMovements.slice(0, 20).map(m => {
                const product = products.find(p => p.id === m.product_id);
                return (
                  <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-xs">
                    <div>
                      <p className="font-medium">{product?.name || 'Produto removido'}</p>
                      <p className="text-muted-foreground">{m.reason} — {new Date(m.date).toLocaleString('pt-BR')}</p>
                    </div>
                    <span className={`font-bold ${m.type === 'entrada' ? 'text-green-500' : 'text-destructive'}`}>
                      {m.type === 'entrada' ? '+' : '-'}{m.quantity}
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
