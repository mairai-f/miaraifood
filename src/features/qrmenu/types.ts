export type AppetiteLevel = 'low' | 'moderate' | 'high';
export type ExperienceMode = 'calm' | 'fast' | 'suggestions';

export interface StepperAnswers {
  hunger: 'pouca' | 'moderada' | 'muita';
  mood: 'tranquilo' | 'com-pressa' | 'irritado';
  headcount: number;
}

export interface MenuItemAddonOption {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemAddonGroup {
  id: string;
  title: string;
  required: boolean;
  minChoices: number;
  maxChoices: number;
  options: MenuItemAddonOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  featured?: boolean;
  addons?: MenuItemAddonGroup[];
}

export interface CartAddonSelection {
  groupId: string;
  optionId: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  notes?: string;
  selectedAddons?: CartAddonSelection[];
}

export interface TableInfo {
  code: string;
  name: string;
}

export interface Recommendation {
  itemName: string;
  reasoning: string;
}

export interface TableSessionState {
  ready: boolean;
  error: string | null;
  establishmentName: string;
  table: TableInfo | null;
  products: MenuItem[];
  sessionOpen: boolean;
  guestToken: string | null;
  stepperAnswers: StepperAnswers | null;
  cart: CartItem[];
  ownOrders: Array<{
    id: string;
    total: number;
    status: string;
    createdAt: string;
    items: Array<{ product_name: string; quantity: number; total: number; notes?: string; status: string }>;
  }>;
  tableTotal: number;
}
