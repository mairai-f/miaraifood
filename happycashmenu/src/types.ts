export type MenuServiceType = "dine_in" | "delivery" | "takeaway";
export type Station = "kitchen" | "bar" | "counter";
export type OptionType = "single" | "multiple" | "quantity";
export type PublicMenuAction = "order" | "call_waiter" | "request_bill";
export type PaymentTiming = "now" | "cashier";

export type PublicStore = {
  id: string;
  slug: string;
  displayName: string;
  receiptName: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  phone: string;
  whatsapp: string;
  addressLine: string;
  city: string;
  state: string;
  acceptsDineIn: boolean;
  acceptsDelivery: boolean;
  deliveryFee: number;
  minimumOrderAmount: number;
  estimatedDeliveryMinutes: number;
  isOpen: boolean;
  happyCashBrand: string;
};

export type MenuTable = {
  id: string;
  code: string;
  name: string;
  area: string;
  seats: number;
  qrSlug: string;
  active: boolean;
};

export type MenuCategory = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  active: boolean;
  qrVisible: boolean;
};

export type MenuOptionValue = {
  id: string;
  name: string;
  priceDelta: number;
  active: boolean;
};

export type MenuOptionGroup = {
  id: string;
  name: string;
  optionType: OptionType;
  minSelected: number;
  maxSelected: number | null;
  required: boolean;
  active: boolean;
  values: MenuOptionValue[];
};

export type MenuItem = {
  id: string;
  categoryId: string | null;
  displayName: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  imageAlt: string;
  station: Station;
  prepMinutes: number;
  tags: string[];
  sortOrder: number;
  featured: boolean;
  active: boolean;
  qrVisible: boolean;
  availableForDineIn: boolean;
  availableForDelivery: boolean;
  promotion: MenuPromotion | null;
  options: MenuOptionGroup[];
};

export type MenuPromotion = {
  id: string;
  menuItemId: string;
  title: string;
  description: string;
  badgeLabel: string;
  discountType: "amount" | "percent" | "fixed_price";
  discountValue: number;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  showOnMenu: boolean;
  sortOrder: number;
  originalPrice?: number;
  promotionalPrice?: number;
};

export type PublicMenuPayload = {
  store: PublicStore;
  table: MenuTable | null;
  categories: MenuCategory[];
  items: MenuItem[];
};

export type CartOptionSelection = {
  groupId: string;
  groupName: string;
  valueId: string;
  valueName: string;
  priceDelta: number;
  quantity: number;
};

export type CartItem = {
  cartId: string;
  itemId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  notes: string;
  station: Station;
  options: CartOptionSelection[];
};

export type CustomerInfo = {
  email: string;
  name: string;
  phone: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  paymentMethod: "pix" | "card" | "debit" | "credit" | "voucher" | "cash";
  loyaltyOptIn: boolean;
};

export type AdminStoreAccount = {
  id: string;
  ownerUserId: string;
  productContext: "happycash" | "happycashfood";
  displayName: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
};

export type AdminPublicProfile = PublicStore & {
  storeAccountId: string;
  ownerUserId: string;
  active: boolean;
};

export type CreateOrderResponse = {
  success: boolean;
  orderId?: string;
  actionType?: PublicMenuAction;
  receiptNumber?: string;
  receiptTitle?: string;
  brandLine?: string;
  error?: string;
};
