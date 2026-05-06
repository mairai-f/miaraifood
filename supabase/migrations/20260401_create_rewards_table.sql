-- Rewards table
CREATE TABLE public.rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  minimum_spending NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view rewards" ON public.rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rewards" ON public.rewards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rewards" ON public.rewards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete rewards" ON public.rewards FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON public.rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
