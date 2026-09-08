import { useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { buildAbcCurve, buildSalesBasedPurchaseSuggestion, type AbcCurveRow, type PurchaseSuggestion } from '@/lib/managementInsights';
import type { Product } from '@/types';

type StockAnalyticsResult = {
  productsById: Map<string, Product>;
  purchaseSuggestions: PurchaseSuggestion[];
  abcRows: AbcCurveRow[];
  stockMovementsCount: number;
};

export function useStockAnalytics(): StockAnalyticsResult {
  const { products, sales, saleItems, stockMovements } = useData();

  const activeProducts = useMemo(() => products.filter((product) => !product.deleted), [products]);
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const { purchaseSuggestions, abcRows } = useMemo(() => {
    const now = Date.now();
    const salesLast30Days = new Set(
      sales
        .filter((sale) => sale.status !== 'cancelled' && now - new Date(sale.date).getTime() <= 30 * 86400000)
        .map((sale) => sale.id),
    );
    const soldByProduct = saleItems.reduce((map, item) => {
      if (item.product_id && salesLast30Days.has(item.sale_id)) {
        map.set(item.product_id, (map.get(item.product_id) ?? 0) + item.quantity);
      }
      return map;
    }, new Map<string, number>());

    const suggestions = activeProducts
      .map((product) => buildSalesBasedPurchaseSuggestion(product, soldByProduct.get(product.id) ?? 0))
      .filter((suggestion): suggestion is PurchaseSuggestion => Boolean(suggestion))
      .sort((left, right) => (
        left.severity === right.severity
          ? right.suggestedQuantity - left.suggestedQuantity
          : left.severity === 'critical' ? -1 : 1
      ));

    const salesLast90Days = new Set(
      sales
        .filter((sale) => sale.status !== 'cancelled' && now - new Date(sale.date).getTime() <= 90 * 86400000)
        .map((sale) => sale.id),
    );
    const curve = buildAbcCurve(
      saleItems
        .filter((item) => Boolean(item.product_id) && salesLast90Days.has(item.sale_id))
        .map((item) => ({
          productId: item.product_id as string,
          revenue: item.net_total ?? item.total,
          quantity: item.quantity,
        })),
    );

    return {
      purchaseSuggestions: suggestions,
      abcRows: curve,
    };
  }, [activeProducts, saleItems, sales]);

  return {
    productsById,
    purchaseSuggestions,
    abcRows,
    stockMovementsCount: stockMovements.length,
  };
}
