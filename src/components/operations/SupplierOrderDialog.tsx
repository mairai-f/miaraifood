import { useEffect, useState } from 'react';
import { Plus, Send, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Product } from '@/types';
import type { SupplierRecord } from '@/types/operations';

export type SupplierOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
};

type SupplierOrderDialogProps = {
  open: boolean;
  initialSupplierId: string;
  suppliers: SupplierRecord[];
  products: Product[];
  onOpenChange: (open: boolean) => void;
  onSend: (supplier: SupplierRecord, items: SupplierOrderItem[]) => Promise<boolean>;
};

export function SupplierOrderDialog({ open, initialSupplierId, suppliers, products, onOpenChange, onSend }: SupplierOrderDialogProps) {
  const [supplierId, setSupplierId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [items, setItems] = useState<SupplierOrderItem[]>([]);
  const [sending, setSending] = useState(false);
  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId);
  const availableProducts = products.filter((product) => !supplierId || !product.supplier_id || product.supplier_id === supplierId);
  const orderTotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  useEffect(() => {
    if (!open) return;
    setSupplierId(initialSupplierId);
    setProductSearch('');
    setQuantity('1');
    setItems([]);
  }, [initialSupplierId, open]);

  const findProduct = () => {
    const query = productSearch.trim().toLocaleUpperCase('pt-BR');
    if (!query) return null;
    return availableProducts.find((product) => product.name.toLocaleUpperCase('pt-BR') === query || product.barcode.toLocaleUpperCase('pt-BR') === query)
      ?? availableProducts.find((product) => product.name.toLocaleUpperCase('pt-BR').startsWith(query))
      ?? null;
  };

  const addItem = () => {
    const product = findProduct();
    const parsedQuantity = Math.max(1, Number.parseInt(quantity, 10) || 1);
    if (!product) return;

    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + parsedQuantity } : item);
      }
      return [...current, {
        productId: product.id,
        productName: product.name,
        quantity: parsedQuantity,
        unitCost: Number(product.cost_price ?? product.purchase_cost ?? 0),
      }];
    });
    setProductSearch('');
    setQuantity('1');
  };

  const submit = async () => {
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier || items.length === 0 || sending) return;
    setSending(true);
    try {
      const sent = await onSend(supplier, items);
      if (sent) onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo pedido ao fornecedor</DialogTitle>
          <DialogDescription>Monte o pedido, registre-o como aberto e envie a mensagem pelo WhatsApp.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Fornecedor</Label>
            <Select value={supplierId} onValueChange={(value) => {
              setSupplierId(value);
              setProductSearch('');
              setItems([]);
            }}>
              <SelectTrigger><SelectValue placeholder="Escolha um fornecedor cadastrado" /></SelectTrigger>
              <SelectContent>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_100px_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Input list="supplier-order-products" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nome ou código de barras" />
              <datalist id="supplier-order-products">{availableProducts.map((product) => <option key={product.id} value={product.name} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={addItem} disabled={!findProduct()}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
          </div>

          <div className="max-h-64 space-y-2 overflow-auto rounded-md border p-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 p-2">
                <div><p className="font-medium">{item.productName}</p><p className="text-xs text-muted-foreground">Quantidade: {item.quantity}</p></div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setItems((current) => current.filter((currentItem) => currentItem.productId !== item.productId))} aria-label={`Remover ${item.productName}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {items.length === 0 && <p className="py-5 text-center text-sm text-muted-foreground">Adicione os produtos que deseja pedir.</p>}
          </div>
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Total estimado</span><strong>R$ {orderTotal.toFixed(2)}</strong></div>
          {selectedSupplier && selectedSupplier.minimum_order > orderTotal && (
            <p className="text-sm text-amber-600">Pedido mínimo deste fornecedor: R$ {selectedSupplier.minimum_order.toFixed(2)}.</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => void submit()} disabled={!supplierId || items.length === 0 || sending}>
            <Send className="mr-2 h-4 w-4" />{sending ? 'Preparando...' : 'Enviar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
