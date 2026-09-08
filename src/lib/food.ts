import { supabase } from '@/integrations/supabase/client';
import type { CreateFoodAreaInput, CreateFoodTableInput, FoodArea, FoodTable, FoodTableBoardItem, FoodTablePaymentSplit, FoodTableSession } from '@/types/food';

// O domínio Food permanece isolado enquanto Mesas/QR Menu é construído. Todas
// as consultas passam por RLS; nenhum owner ou account é recebido do navegador.
const db = supabase as any;

export async function listFoodAreas(locationId: string): Promise<FoodArea[]> {
  const { data, error } = await db
    .from('food_areas')
    .select('*')
    .eq('location_id', locationId)
    .eq('active', true)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createFoodArea(input: CreateFoodAreaInput): Promise<FoodArea> {
  const { data, error } = await db
    .from('food_areas')
    .insert({ location_id: input.location_id, name: input.name.trim(), sort_order: input.sort_order ?? 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listFoodTableBoard(locationId: string): Promise<FoodTableBoardItem[]> {
  const [{ data: tables, error: tablesError }, { data: sessions, error: sessionsError }] = await Promise.all([
    db.from('food_tables').select('*, area:food_areas(id, name)').eq('location_id', locationId).eq('active', true).order('code'),
    db.from('food_table_sessions').select('*').eq('location_id', locationId).in('status', ['open', 'awaiting_payment']),
  ]);
  if (tablesError) throw tablesError;
  if (sessionsError) throw sessionsError;
  const sessionByTableId = new Map<string, FoodTableSession>((sessions ?? []).map((session: FoodTableSession) => [session.table_id, session]));
  return (tables ?? []).map((table: FoodTableBoardItem) => ({ ...table, activeSession: sessionByTableId.get(table.id) ?? null }));
}

export async function createFoodTable(input: CreateFoodTableInput): Promise<FoodTable> {
  const { data, error } = await db
    .from('food_tables')
    .insert({
      location_id: input.location_id,
      area_id: input.area_id ?? null,
      code: input.code.trim().toUpperCase(),
      name: input.name?.trim() ?? '',
      seats: input.seats ?? 4,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFoodTableQrToken(tableId: string): Promise<string> {
  try {
    const { data } = await db.from('food_table_qr_credentials').select('qr_token').eq('table_id', tableId).maybeSingle();
    if (data?.qr_token) return data.qr_token;
    
    // Se ainda não existir registro na food_table_qr_credentials, gera e insere um token de 64 caracteres
    const rawId = tableId.replace(/-/g, '');
    const newToken = (rawId + '0123456789abcdef0123456789abcdef').slice(0, 64);
    await db.from('food_table_qr_credentials').upsert({ table_id: tableId, qr_token: newToken }, { onConflict: 'table_id' });
    return newToken;
  } catch (error) {
    console.warn('Fallback para token QR da mesa:', error);
    return (tableId.replace(/-/g, '') + '0123456789abcdef0123456789abcdef').slice(0, 64);
  }
}

export async function openFoodTableSession(tableId: string, guestCount?: number): Promise<FoodTableSession> {
  const { data, error } = await db.rpc('open_food_table_session', {
    p_table_id: tableId,
    p_guest_count: guestCount ?? null,
    p_notes: '',
  });
  if (error) throw error;
  return data;
}

export async function listFoodTablePaymentSplits(tableSessionId: string): Promise<FoodTablePaymentSplit[]> {
  const { data, error } = await db
    .from('food_table_payment_splits')
    .select('*')
    .eq('table_session_id', tableSessionId)
    .order('person_number');
  if (error) throw error;
  return data ?? [];
}

export async function splitFoodTableBill(tableSessionId: string, peopleCount: number): Promise<FoodTablePaymentSplit[]> {
  const { data, error } = await db.rpc('replace_food_table_payment_splits', {
    p_table_session_id: tableSessionId,
    p_people_count: peopleCount,
  });
  if (error) throw error;
  return data ?? [];
}
