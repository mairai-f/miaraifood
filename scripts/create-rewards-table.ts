import { supabase } from './src/integrations/supabase/client.ts';

async function createRewardsTable() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.rewards (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        minimum_spending NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Authenticated users can view rewards" ON public.rewards;
      DROP POLICY IF EXISTS "Authenticated users can insert rewards" ON public.rewards;
      DROP POLICY IF EXISTS "Authenticated users can update rewards" ON public.rewards;
      DROP POLICY IF EXISTS "Authenticated users can delete rewards" ON public.rewards;

      CREATE POLICY "Authenticated users can view rewards" ON public.rewards FOR SELECT TO authenticated USING (true);
      CREATE POLICY "Authenticated users can insert rewards" ON public.rewards FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY "Authenticated users can update rewards" ON public.rewards FOR UPDATE TO authenticated USING (true);
      CREATE POLICY "Authenticated users can delete rewards" ON public.rewards FOR DELETE TO authenticated USING (true);

      DROP TRIGGER IF EXISTS update_rewards_updated_at ON public.rewards;
      CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON public.rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    `;

    const { error } = await supabase.rpc('exec', { sql });
    if (error) throw error;
    
    console.log('✅ Tabela de recompensas criada com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao criar tabela:', err);
  }
}

createRewardsTable();
