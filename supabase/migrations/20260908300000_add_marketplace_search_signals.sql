-- Busca e tendências do Marketplace sem o endpoint REST /demanda.
CREATE TABLE IF NOT EXISTS public.marketplace_search_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL CHECK (char_length(btrim(term)) BETWEEN 3 AND 160),
  region text,
  result_count integer NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  state text NOT NULL CHECK (state IN ('found','not_found')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marketplace_search_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketplace_search_signals_public_insert ON public.marketplace_search_signals FOR INSERT TO anon, authenticated WITH CHECK (char_length(btrim(term)) BETWEEN 3 AND 160 AND result_count >= 0);
CREATE OR REPLACE VIEW public.marketplace_demand_trends
WITH (security_invoker = false) AS
SELECT lower(btrim(term)) AS term, count(*)::integer AS count,
  CASE WHEN bool_or(state = 'found') THEN 'found' ELSE 'not_found' END AS state,
  max(created_at) AS last_seen
FROM public.marketplace_search_signals
GROUP BY lower(btrim(term))
ORDER BY count(*) DESC, max(created_at) DESC;
GRANT SELECT ON public.marketplace_demand_trends TO anon, authenticated;
