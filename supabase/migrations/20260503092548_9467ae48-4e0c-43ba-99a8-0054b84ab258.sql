
-- =========== Tables ===========
CREATE TABLE public.gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  description text,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  storage_path text NOT NULL,
  thumbnail_path text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  storage_path text,
  external_url text,
  duration_minutes int,
  recorded_on date,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  meeting_url text NOT NULL,
  platform text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========== Triggers ===========
CREATE TRIGGER trg_gallery_items_updated BEFORE UPDATE ON public.gallery_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_recordings_updated BEFORE UPDATE ON public.recordings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_live_classes_updated BEFORE UPDATE ON public.live_classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== RLS ===========
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "Owner manages own gallery" ON public.gallery_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manages owner gallery" ON public.gallery_items FOR ALL TO authenticated
  USING (user_id = public.get_owner_id(auth.uid())) WITH CHECK (user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Owner manages own recordings" ON public.recordings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manages owner recordings" ON public.recordings FOR ALL TO authenticated
  USING (user_id = public.get_owner_id(auth.uid())) WITH CHECK (user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Owner manages own live classes" ON public.live_classes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manages owner live classes" ON public.live_classes FOR ALL TO authenticated
  USING (user_id = public.get_owner_id(auth.uid())) WITH CHECK (user_id = public.get_owner_id(auth.uid()));

-- =========== Storage buckets (private; signed URLs used) ===========
INSERT INTO storage.buckets (id, name, public) VALUES ('studio-gallery', 'studio-gallery', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('studio-recordings', 'studio-recordings', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies (workspace-scoped: first folder = owner uuid)
CREATE POLICY "Workspace reads gallery files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'studio-gallery' AND (
  (storage.foldername(name))[1] = auth.uid()::text OR
  (storage.foldername(name))[1] = public.get_owner_id(auth.uid())::text
));
CREATE POLICY "Workspace writes gallery files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'studio-gallery' AND (
  (storage.foldername(name))[1] = auth.uid()::text OR
  (storage.foldername(name))[1] = public.get_owner_id(auth.uid())::text
));
CREATE POLICY "Workspace updates gallery files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'studio-gallery' AND (
  (storage.foldername(name))[1] = auth.uid()::text OR
  (storage.foldername(name))[1] = public.get_owner_id(auth.uid())::text
));
CREATE POLICY "Workspace deletes gallery files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'studio-gallery' AND (
  (storage.foldername(name))[1] = auth.uid()::text OR
  (storage.foldername(name))[1] = public.get_owner_id(auth.uid())::text
));

CREATE POLICY "Workspace reads recordings files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'studio-recordings' AND (
  (storage.foldername(name))[1] = auth.uid()::text OR
  (storage.foldername(name))[1] = public.get_owner_id(auth.uid())::text
));
CREATE POLICY "Workspace writes recordings files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'studio-recordings' AND (
  (storage.foldername(name))[1] = auth.uid()::text OR
  (storage.foldername(name))[1] = public.get_owner_id(auth.uid())::text
));
CREATE POLICY "Workspace updates recordings files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'studio-recordings' AND (
  (storage.foldername(name))[1] = auth.uid()::text OR
  (storage.foldername(name))[1] = public.get_owner_id(auth.uid())::text
));
CREATE POLICY "Workspace deletes recordings files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'studio-recordings' AND (
  (storage.foldername(name))[1] = auth.uid()::text OR
  (storage.foldername(name))[1] = public.get_owner_id(auth.uid())::text
));

-- Public can read files for items marked is_public (objects whose path is referenced in a public row)
CREATE POLICY "Public reads public gallery files" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'studio-gallery' AND EXISTS (
  SELECT 1 FROM public.gallery_items gi WHERE gi.is_public = true AND (gi.storage_path = name OR gi.thumbnail_path = name)
));
CREATE POLICY "Public reads public recording files" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'studio-recordings' AND EXISTS (
  SELECT 1 FROM public.recordings r WHERE r.is_public = true AND r.storage_path = name
));

-- =========== Public RPCs (for public studio page) ===========
CREATE OR REPLACE FUNCTION public.get_public_gallery(_owner uuid)
RETURNS TABLE(id uuid, title text, description text, media_type text, storage_path text, thumbnail_path text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, title, description, media_type, storage_path, thumbnail_path, created_at
  FROM public.gallery_items WHERE user_id = _owner AND is_public = true
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_public_recordings(_owner uuid)
RETURNS TABLE(id uuid, title text, description text, storage_path text, external_url text, duration_minutes int, recorded_on date, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, title, description, storage_path, external_url, duration_minutes, recorded_on, created_at
  FROM public.recordings WHERE user_id = _owner AND is_public = true
  ORDER BY recorded_on DESC NULLS LAST, created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_public_live_classes(_owner uuid)
RETURNS TABLE(id uuid, title text, description text, scheduled_at timestamptz, duration_minutes int, meeting_url text, platform text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, title, description, scheduled_at, duration_minutes, meeting_url, platform
  FROM public.live_classes WHERE user_id = _owner AND is_public = true AND scheduled_at >= now() - interval '2 hours'
  ORDER BY scheduled_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_gallery(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_public_recordings(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_public_live_classes(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_gallery(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_recordings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_live_classes(uuid) TO anon, authenticated;
