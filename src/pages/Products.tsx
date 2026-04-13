import { useState } from 'react';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/types';
import { canManageProducts } from '@/lib/access';

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useData();
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [category, setCategory] = useState('');
  const [barcode, setBarcode] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const readOnly = !canManageProducts(role);

  const activeProducts = products.filter(p => !('deleted' in p && (p as any).deleted));
  const filtered = activeProducts.filter(p => {
    const q = search.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.code?.toString().includes(q)
    );
  });

  const getMargin = (sell: number, cost: number) => {
    if (!cost || cost === 0) return 0;
    return ((sell - cost) / cost) * 100;
  };

  const handleSave = async () => {
    if (!name.trim() || !price) { toast.error('Preencha nome e preço'); return; }
    const data: any = {
      name: name.trim(),
      price: parseFloat(price),
      cost_price: parseFloat(costPrice) || 0,
      category: category.trim(),
      barcode: barcode.trim(),
      stock: parseInt(stock) || 0,
      min_stock: parseInt(minStock) || 0,
    };
    if (editId) {
      try {
        await updateProduct(editId, data);
        toast.success('Produto atualizado!');
      } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        toast.error('Não foi possível atualizar o produto');
        return;
      }
    } else {
      try {
        await addProduct(data.name, data.price, data.category, data);
        toast.success('Produto cadastrado!');
      } catch (error) {
        console.error('Erro ao cadastrar produto:', error);
        toast.error('Não foi possível cadastrar o produto');
        return;
      }
    }
    resetForm();
  };

  const resetForm = () => { setName(''); setPrice(''); setCostPrice(''); setCategory(''); setBarcode(''); setStock(''); setMinStock(''); setEditId(null); setOpen(false); };

  const openEdit = (p: Product) => {
    setEditId(p.id); setName(p.name); setPrice(p.price.toString());
    setCostPrice((p.cost_price || 0).toString()); setCategory(p.category);
    setBarcode(p.barcode || ''); setStock((p.stock || 0).toString()); setMinStock((p.min_stock || 0).toString());
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Produtos</h1>
          {readOnly && <p className="text-sm text-muted-foreground">Modo operador: consulta liberada, edição bloqueada.</p>}
        </div>
        {!readOnly && (
          <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? 'Editar Produto' : 'Cadastrar Produto'}</DialogTitle></DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-auto">
                <div className="space-y-1"><Label>Nome / Marca</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Skol 600ml" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Preço Venda (R$)</Label><Input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" /></div>
                  <div className="space-y-1"><Label>Preço Custo (R$)</Label><Input type="number" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0.00" /></div>
                </div>
                {price && costPrice && parseFloat(costPrice) > 0 && (
                  <div className="flex items-center gap-2 text-xs p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span>Margem de lucro: <strong>{getMargin(parseFloat(price), parseFloat(costPrice)).toFixed(1)}%</strong></span>
                  </div>
                )}
                <div className="space-y-1"><Label>Código de Barras</Label><Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Ex: 7891234567890" /></div>
                <div className="space-y-1"><Label>Categoria</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Cerveja, Cigarro" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Estoque</Label><Input type="number" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" /></div>
                  <div className="space-y-1"><Label>Estoque Mínimo</Label><Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="0" /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={handleSave} className="w-full sm:w-auto">{editId ? 'Salvar' : 'Cadastrar'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => {
          const margin = getMargin(p.price, p.cost_price);
          return (
            <motion.div key={p.id} whileHover={{ scale: 1.02 }}>
              <Card className={`border-border/50 ${p.stock <= p.min_stock && p.min_stock > 0 ? 'border-destructive/30' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2 min-w-0">
                    <div className="min-w-0 mr-2">
                      <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                      <span className="text-xs text-muted-foreground">{p.code ? `#${p.code}` : 'Sem código'}{p.category ? ` - ${p.category}` : ''}</span>
                    </div>
                    <span className="text-primary font-bold text-sm whitespace-nowrap">R$ {p.price.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground mb-2">
                    {p.cost_price > 0 && <span>Custo: R$ {p.cost_price.toFixed(2)}</span>}
                    {p.cost_price > 0 && <span className="text-primary font-medium">Lucro: {margin.toFixed(1)}%</span>}
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
