import { supabase } from './supabase';

export type ApplicationStatus = 'pending' | 'info_requested' | 'approved' | 'rejected' | 'cancelled';
export type PartnerApplication = {
  id: string; full_name: string; email: string; phone: string; cpf: string; city: string; state: string;
  segments: string[]; representation_type?: string; experience?: string | null; status: ApplicationStatus; created_at: string;
};
export type DriverApplication = {
  id: string; full_name: string; email: string; phone: string; cpf: string; city: string; state: string;
  vehicle_type: string; vehicle_plate?: string | null; vehicle_model?: string | null; status: ApplicationStatus; document_status: string; created_at: string;
};

async function requireAdmin() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Sessão expirada.');
  const role = String(user.app_metadata?.role || user.user_metadata?.role || '');
  if (!import.meta.env.DEV && !['admin', 'platform_admin', 'supergestora'].includes(role)) throw new Error('Acesso administrativo necessário.');
  return user;
}

export async function listApplications(status?: ApplicationStatus) {
  await requireAdmin();
  let reps = supabase.from('representative_applications').select('*').order('created_at', { ascending: false });
  let drivers = supabase.from('delivery_driver_applications').select('*').order('created_at', { ascending: false });
  if (status) { reps = reps.eq('status', status); drivers = drivers.eq('status', status); }
  const [{ data: representatives, error: repError }, { data: deliveryDrivers, error: driverError }] = await Promise.all([reps, drivers]);
  if (repError) throw repError;
  if (driverError) throw driverError;
  return { representatives: (representatives || []) as PartnerApplication[], deliveryDrivers: (deliveryDrivers || []) as DriverApplication[] };
}

export async function decideApplication(table: 'representative_applications' | 'delivery_driver_applications', id: string, status: Exclude<ApplicationStatus, 'pending' | 'cancelled'>, notes?: string) {
  const user = await requireAdmin();
  const { error } = await supabase.from(table).update({ status, review_notes: notes || null, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
