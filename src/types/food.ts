export type FoodTableSessionStatus = 'open' | 'awaiting_payment' | 'closed' | 'cancelled';
export type FoodOrderSource = 'table' | 'qrmenu' | 'counter' | 'pickup' | 'delivery';
export type FoodOrderStatus = 'draft' | 'submitted' | 'preparing' | 'ready' | 'delivered' | 'awaiting_payment' | 'closed' | 'cancelled';

export type FoodArea = {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  location_id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FoodTable = {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  location_id: string;
  area_id: string | null;
  code: string;
  name: string;
  seats: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FoodTableSession = {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  location_id: string;
  table_id: string;
  service_ticket_id: string | null;
  status: FoodTableSessionStatus;
  guest_count: number | null;
  opened_by_user_id: string | null;
  closed_by_user_id: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string;
};

export type FoodTableBoardItem = FoodTable & {
  area?: Pick<FoodArea, 'id' | 'name'> | null;
  activeSession?: FoodTableSession | null;
};

export type FoodTablePaymentSplit = {
  id: string;
  table_session_id: string;
  person_number: number;
  amount_due: number;
  amount_paid: number;
  payment_method: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'fiado' | null;
  status: 'pending' | 'paid' | 'cancelled';
};

export type CreateFoodAreaInput = Pick<FoodArea, 'location_id' | 'name'> & { sort_order?: number };
export type CreateFoodTableInput = Pick<FoodTable, 'location_id' | 'code'> & Pick<Partial<FoodTable>, 'area_id' | 'name' | 'seats'>;
