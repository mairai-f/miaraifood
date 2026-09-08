import React from 'react';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
let baseUrl = '';
let extraHeaders: () => Record<string,string> = () => ({});
export const setBaseUrl = (url: string) => { baseUrl = url; };
export const installApiFetchBaseUrl = setBaseUrl;
export const setExtraHeadersGetter = (getter: () => Record<string,string>) => { extraHeaders = getter; };
export const apiBaseUrl = () => baseUrl;
export const apiHeaders = () => extraHeaders();
export function MiarEditaMenu() { return React.createElement('span', { 'aria-hidden': true }); }

let supabaseClient: SupabaseClient | null = null;
export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase não configurado neste aplicativo.');
  supabaseClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return supabaseClient;
}
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}
export function sessionHeaders(session: Session | null) {
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}
