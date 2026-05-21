-- Include service duration in the shared extra-services RPC used by Agenda dashboards.

DROP FUNCTION IF EXISTS public.get_appointment_extra_services(uuid[]);

CREATE OR REPLACE FUNCTION public.get_appointment_extra_services(p_appointment_ids uuid[])
RETURNS TABLE (
  appointment_id uuid,
  service_id uuid,
  service_name text,
  service_price numeric,
  service_duration integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    aps.appointment_id,
    s.id AS service_id,
    s.name AS service_name,
    s.price AS service_price,
    s.duration_minutes AS service_duration
  FROM public.appointment_services aps
  JOIN public.services s ON s.id = aps.service_id
  WHERE aps.appointment_id = ANY(p_appointment_ids)
$$;
