import { createClient } from '@supabase/supabase-js';

// Variáveis de ambiente públicas (Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Cliente Supabase seguro para uso no Frontend.
 * Utiliza apenas a Anon Key pública. As operações são protegidas
 * pelas regras de Row Level Security (RLS) no banco PostgreSQL.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'miar-auth-token',
  },
});

/**
 * Recupera o ID do tenant (company_id) do usuário atualmente autenticado.
 */
export async function getCurrentCompanyId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return session.user.user_metadata?.company_id ?? null;
}

/**
 * Recupera as permissões de módulo do usuário atual.
 */
export async function getCurrentUserPermissions(): Promise<string[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];
  
  // Se for proprietário ou gerente, possui acesso total por padrão
  const role = session.user.user_metadata?.role;
  if (role === 'owner' || role === 'manager' || role === 'superadmin') {
    return [
      'dashboard', 'pdv', 'cozinha', 'mesas', 'comando', 'cardapio',
      'estoque', 'compras', 'financeiro', 'funcionarios', 'ia', 'configuracoes'
    ];
  }

  // Busca permissões salvas na tabela de permissões para colaboradores (ex: garçom, caixa, cozinheiro)
  const { data: permissions } = await supabase
    .from('user_permissions')
    .select('module_key')
    .eq('user_id', session.user.id)
    .eq('can_read', true);

  return permissions ? permissions.map((p) => p.module_key) : [];
}
