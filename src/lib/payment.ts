export interface PaymentSnapshotItem {
  product_name: string;
  quantity: number;
  total: number;
  date_added: string;
  registered_by?: string | null;
}

interface ParsedPaymentType {
  kind: 'total' | 'partial';
}

export const parsePaymentType = (rawType?: string | null): ParsedPaymentType => {
  if (!rawType) return { kind: 'partial' };
  return { kind: rawType === 'total' ? 'total' : 'partial' };
};

export const getPaymentLabel = (rawType?: string | null) =>
  parsePaymentType(rawType).kind === 'total' ? 'Pagamento Total' : 'Pagamento Parcial';

export const parsePaymentDetails = (rawDetails: unknown): PaymentSnapshotItem[] => {
  if (!Array.isArray(rawDetails)) return [];

  return rawDetails
    .filter((item): item is PaymentSnapshotItem =>
      !!item &&
      typeof item === 'object' &&
      'product_name' in item &&
      'quantity' in item &&
      'total' in item &&
      'date_added' in item
    )
    .map(item => ({
      product_name: item.product_name,
      quantity: Number(item.quantity) || 0,
      total: Number(item.total) || 0,
      date_added: String(item.date_added),
      registered_by: item.registered_by ? String(item.registered_by) : null,
    }));
};

export const groupPaymentSnapshotItems = (items: PaymentSnapshotItem[]) => {
  const groups = new Map<string, PaymentSnapshotItem>();

  for (const item of items) {
    const key = [
      item.product_name.trim().toLowerCase(),
      item.date_added,
      item.registered_by ?? '',
    ].join('::');

    const existing = groups.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      existing.total += item.total;
      continue;
    }

    groups.set(key, { ...item });
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()
  );
};
