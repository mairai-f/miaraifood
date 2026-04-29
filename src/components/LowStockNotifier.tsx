import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';

type StockSnapshot = {
  stock: number;
  minStock: number;
  name: string;
};

const formatLowStockMessage = (product: StockSnapshot) =>
  `${product.name} ficou com ${product.stock} un. (mínimo: ${product.minStock}).`;

export function LowStockNotifier() {
  const { products, loading } = useData();
  const previousProductsRef = useRef<Map<string, StockSnapshot> | null>(null);

  useEffect(() => {
    if (loading) return;

    const currentProducts = new Map<string, StockSnapshot>();

    products
      .filter(product => !product.deleted)
      .forEach(product => {
        currentProducts.set(product.id, {
          stock: product.stock ?? 0,
          minStock: product.min_stock ?? 0,
          name: product.name,
        });
      });

    const previousProducts = previousProductsRef.current;
    previousProductsRef.current = currentProducts;

    if (!previousProducts) return;

    const productsThatReachedMinimum = Array.from(currentProducts.entries())
      .filter(([, product]) => product.minStock > 0 && product.stock <= product.minStock)
      .filter(([productId, product]) => {
        const previous = previousProducts.get(productId);
        return previous && previous.stock > product.minStock;
      })
      .map(([, product]) => product);

    if (productsThatReachedMinimum.length === 0) return;

    if (productsThatReachedMinimum.length === 1) {
      toast.warning('Estoque mínimo atingido', {
        description: formatLowStockMessage(productsThatReachedMinimum[0]),
      });
      return;
    }

    const firstProduct = productsThatReachedMinimum[0];
    toast.warning(`${productsThatReachedMinimum.length} produtos chegaram no estoque mínimo`, {
      description: `${formatLowStockMessage(firstProduct)} E mais ${productsThatReachedMinimum.length - 1} item(ns).`,
    });
  }, [loading, products]);

  return null;
}
