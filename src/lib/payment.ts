export interface PaymentSnapshotItem {
  product_name: string;
  quantity: number;
  total: number;
  date_added: string;
  registered_by?: string | null;
}

export interface PaymentAdjustmentDetails {
  paidAmount: number;
  discountAmount: number;
  discountType: 'amount' | 'percent' | null;
  discountValue: number;
  creditedAmount: number;
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

const getDetailsItems = (rawDetails: unknown): unknown => {
  if (Array.isArray(rawDetails)) return rawDetails;
  if (rawDetails && typeof rawDetails === 'object' && 'items' in rawDetails) {
    return (rawDetails as { items?: unknown }).items;
  }
  return [];
};

export const parsePaymentDetails = (rawDetails: unknown): PaymentSnapshotItem[] => {
  const items = getDetailsItems(rawDetails);
  if (!Array.isArray(items)) return [];

  return items
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

export const parsePaymentAdjustmentDetails = (rawDetails: unknown): PaymentAdjustmentDetails | null => {
  if (!rawDetails || typeof rawDetails !== 'object' || !('payment' in rawDetails)) return null;

  const payment = (rawDetails as { payment?: Record<string, unknown> }).payment;
  if (!payment || typeof payment !== 'object') return null;

  const discountType = payment.discount_type === 'amount' || payment.discount_type === 'percent'
    ? payment.discount_type
    : null;

  return {
    paidAmount: Number(payment.paid_amount) || 0,
    discountAmount: Number(payment.discount_amount) || 0,
    discountType,
    discountValue: Number(payment.discount_value) || 0,
    creditedAmount: Number(payment.credited_amount) || 0,
  };
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
