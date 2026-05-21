import { Package, ShoppingCart, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
}

interface ProductSalesTabProps {
  products: Product[];
}

export function ProductSalesTab({ products }: ProductSalesTabProps) {
  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5);
  const outOfStock = products.filter(p => p.stock_quantity <= 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Produtos</p>
                <p className="text-3xl font-bold">{totalProducts}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Estoque</p>
                <p className="text-3xl font-bold">{totalStock}</p>
                <p className="text-xs text-muted-foreground">unidades total</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <ShoppingCart className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                <p className="text-3xl font-bold text-amber-500">{lowStock.length}</p>
                <p className="text-xs text-muted-foreground">{outOfStock.length} esgotados</p>
              </div>
              <div className="p-3 rounded-full bg-amber-500/10">
                <TrendingUp className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product List */}
      <div className="space-y-3">
        <h3 className="font-serif text-lg font-semibold">Inventário de Produtos</h3>
        {products.map(product => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{product.name}</span>
                    {product.category && <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">R$ {product.price.toFixed(2)}</div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={product.stock_quantity <= 0 ? 'destructive' : product.stock_quantity <= 5 ? 'secondary' : 'default'}>
                    {product.stock_quantity <= 0 ? 'Esgotado' : `${product.stock_quantity} un`}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
