CREATE TABLE public.tv_artworks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 screen_id uuid NOT NULL REFERENCES public.tv_screens(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
 image_url text NOT NULL,
 format text NOT NULL DEFAULT 'tv' CHECK (format IN ('tv','panel','stories','print')),
 starts_at timestamptz,
 ends_at timestamptz,
 seconds integer NOT NULL DEFAULT 10 CHECK (seconds BETWEEN 4 AND 60),
 sort_order integer NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true,
 CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
ALTER TABLE public.tv_artworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY artworks_manage ON public.tv_artworks FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.tv_screens s WHERE s.id = screen_id AND s.owner_user_id = public.get_current_store_owner_id() AND public.current_user_has_erp_permission('settings.manage')))
WITH CHECK (EXISTS (SELECT 1 FROM public.tv_screens s WHERE s.id = screen_id AND s.owner_user_id = public.get_current_store_owner_id() AND public.current_user_has_erp_permission('settings.manage')));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_artworks TO authenticated;
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('tv-artworks','tv-artworks',true,10485760,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT DO NOTHING;
CREATE POLICY tv_art_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tv-artworks' AND (storage.foldername(name))[1] = public.get_current_store_owner_id()::text AND public.current_user_has_erp_permission('settings.manage'));
ALTER FUNCTION public.get_tv_screen_payload(text) RENAME TO get_tv_screen_payload_base;
CREATE FUNCTION public.get_tv_screen_payload(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE body jsonb; arts jsonb;
BEGIN
 body := public.get_tv_screen_payload_base(p_code);
 IF body IS NULL THEN RETURN NULL; END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.sort_order,a.id),'[]'::jsonb) INTO arts
 FROM public.tv_artworks a JOIN public.tv_screens s ON s.id = a.screen_id
 WHERE s.access_code = upper(p_code) AND a.active;
 body := (body - 'version') || jsonb_build_object('artworks',arts);
 RETURN body || jsonb_build_object('version',md5(body::text));
END $$;
REVOKE ALL ON FUNCTION public.get_tv_screen_payload(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_tv_screen_payload(text) TO service_role;
