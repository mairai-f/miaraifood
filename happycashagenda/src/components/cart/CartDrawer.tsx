import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

export function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, total, clearCart } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="font-serif flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Carrinho ({items.length})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 px-6">
            <ShoppingBag className="w-16 h-16 opacity-30" />
            <p className="text-lg font-medium">Carrinho vazio</p>
            <p className="text-sm">Adicione produtos para continuar</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {items.map(item => (
                <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                  <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{item.name}</h4>
                    <p className="text-primary font-bold text-sm">R$ {item.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full ml-auto text-destructive hover:text-destructive" onClick={() => removeItem(item.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-6 py-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total</span>
                <span className="text-2xl font-bold font-serif">R$ {total.toFixed(2)}</span>
              </div>
              <Button className="w-full rounded-full" size="lg">
                Finalizar Compra
              </Button>
              <Button variant="ghost" size="sm" onClick={clearCart} className="w-full text-muted-foreground">
                Limpar carrinho
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
