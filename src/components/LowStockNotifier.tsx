import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { playDoubleAlertBeep } from '@/lib/audio';

/** Quantos dias antes do vencimento o sistema deve alertar */
const EXPIRY_ALERT_DAYS = 7;

type StockSnapshot = {
  stock: number;
  minStock: number;
  name: string;
};

const formatLowStockMessage = (product: StockSnapshot) =>
  `${product.name} ficou com ${product.stock} un. (mínimo: ${product.minStock}).`;

function getDaysUntilExpiry(expiryDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr + 'T00:00:00');
  const diff = expiry.getTime() - today.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function LowStockNotifier() {
  const { products, loading } = useData();
  const previousProductsRef = useRef<Map<string, StockSnapshot> | null>(null);
  const initialExpiryAlertDoneRef = useRef(false);

  // --- Alerta de estoque baixo (por diff de estado, igual ao anterior) ---
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

    playDoubleAlertBeep();

    if (productsThatReachedMinimum.length === 1) {
      toast.warning('⚠️ Estoque mínimo atingido', {
        description: formatLowStockMessage(productsThatReachedMinimum[0]),
        duration: 8000,
      });
      return;
    }

    const firstProduct = productsThatReachedMinimum[0];
    toast.warning(`⚠️ ${productsThatReachedMinimum.length} produtos chegaram no estoque mínimo`, {
      description: `${formatLowStockMessage(firstProduct)} E mais ${productsThatReachedMinimum.length - 1} item(ns).`,
      duration: 8000,
    });
  }, [loading, products]);

  // --- Alerta de vencimento próximo (verificação na montagem e quando produtos carregam) ---
  useEffect(() => {
    if (loading) return;
    if (initialExpiryAlertDoneRef.current) return;
    initialExpiryAlertDoneRef.current = true;

    const expiringProducts = products
      .filter(product => !product.deleted && product.expiry_date)
      .map(product => ({
        name: product.name,
        daysLeft: getDaysUntilExpiry(product.expiry_date!),
        expiryDate: product.expiry_date!,
      }))
      .filter(item => item.daysLeft <= EXPIRY_ALERT_DAYS)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    if (expiringProducts.length === 0) return;

    playDoubleAlertBeep();

    const expired = expiringProducts.filter(p => p.daysLeft < 0);
    const nearExpiry = expiringProducts.filter(p => p.daysLeft >= 0);

    if (expired.length > 0) {
      toast.error(`🚨 ${expired.length} produto(s) vencido(s)!`, {
        description: expired
          .slice(0, 3)
          .map(p => `${p.name} (venceu há ${Math.abs(p.daysLeft)} dias)`)
          .join(' | '),
        duration: 12000,
      });
    }

    if (nearExpiry.length > 0) {
      const first = nearExpiry[0];
      const label =
        first.daysLeft === 0
          ? `${first.name} vence HOJE!`
          : `${first.name} vence em ${first.daysLeft} dia(s).`;

      toast.warning(
        nearExpiry.length === 1
          ? '📅 Produto próximo do vencimento'
          : `📅 ${nearExpiry.length} produtos próximos do vencimento`,
        {
          description:
            nearExpiry.length === 1
              ? label
              : `${label}${nearExpiry.length > 1 ? ` E mais ${nearExpiry.length - 1} produto(s).` : ''}`,
          duration: 10000,
        },
      );
    }
  }, [loading, products]);

  return null;
}
