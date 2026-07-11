
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS auto_convert_to_recording boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_visibility text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS recording_publish_delay_minutes integer,
  ADD COLUMN IF NOT EXISTS recording_hide_after_days integer,
  ADD COLUMN IF NOT EXISTS converted_recording_id uuid,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_live_class_id uuid REFERENCES public.live_classes(id) ON DELETE SET NULL;

UPDATE public.recordings
SET public_slug = replace(replace(replace(encode(gen_random_bytes(9), 'base64'), '+',''), '/',''), '=','')
WHERE public_slug IS NULL;

CREATE OR REPLACE FUNCTION public.recordings_set_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.public_slug IS NULL THEN
    NEW.public_slug := replace(replace(replace(encode(gen_random_bytes(9), 'base64'), '+',''), '/',''), '=','');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recordings_set_slug_trg ON public.recordings;
CREATE TRIGGER recordings_set_slug_trg BEFORE INSERT ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.recordings_set_slug();

DROP FUNCTION IF EXISTS public.get_public_recordings(uuid);
CREATE FUNCTION public.get_public_recordings(_owner uuid)
RETURNS TABLE(id uuid, title text, description text, storage_path text, external_url text, duration_minutes integer, recorded_on date, created_at timestamp with time zone, public_slug text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, title, description, storage_path, external_url, duration_minutes, recorded_on, created_at, public_slug
  FROM public.recordings
  WHERE user_id = _owner AND is_public = true
    AND archived_at IS NULL
    AND (publish_at IS NULL OR publish_at <= now())
  ORDER BY recorded_on DESC NULLS LAST, created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_public_recordings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_recordings(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_recording_by_slug(_slug text)
RETURNS TABLE(id uuid, user_id uuid, title text, description text, storage_path text, external_url text, duration_minutes integer, recorded_on date, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, user_id, title, description, storage_path, external_url, duration_minutes, recorded_on, created_at
  FROM public.recordings
  WHERE public_slug = _slug
    AND is_public = true
    AND archived_at IS NULL
    AND (publish_at IS NULL OR publish_at <= now());
$$;
REVOKE ALL ON FUNCTION public.get_recording_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recording_by_slug(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_live_class_lifecycle()
RETURNS TABLE(converted integer, archived integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lc RECORD;
  _new_rec_id uuid;
  _publish_at timestamptz;
  _expires_at timestamptz;
  _converted int := 0;
  _archived int := 0;
BEGIN
  FOR _lc IN
    SELECT * FROM public.live_classes
    WHERE auto_convert_to_recording = true
      AND converted_recording_id IS NULL
      AND (scheduled_at + make_interval(mins => duration_minutes)) <= now()
  LOOP
    IF _lc.recording_visibility = 'immediate' THEN
      _publish_at := now();
    ELSIF _lc.recording_visibility = 'delayed' THEN
      _publish_at := now() + make_interval(mins => COALESCE(_lc.recording_publish_delay_minutes, 0));
    ELSE
      _publish_at := NULL;
    END IF;

    IF _lc.recording_hide_after_days IS NOT NULL THEN
      _expires_at := COALESCE(_publish_at, now()) + make_interval(days => _lc.recording_hide_after_days);
    ELSE
      _expires_at := NULL;
    END IF;

    INSERT INTO public.recordings (
      user_id, title, description, external_url, duration_minutes, recorded_on,
      is_public, publish_at, expires_at, source_live_class_id
    ) VALUES (
      _lc.user_id, _lc.title, _lc.description, _lc.meeting_url, _lc.duration_minutes, (_lc.scheduled_at)::date,
      COALESCE(_lc.is_public, false), _publish_at, _expires_at, _lc.id
    ) RETURNING id INTO _new_rec_id;

    UPDATE public.live_classes
      SET converted_recording_id = _new_rec_id, converted_at = now()
      WHERE id = _lc.id;
    _converted := _converted + 1;
  END LOOP;

  WITH updated AS (
    UPDATE public.recordings
      SET archived_at = now()
      WHERE archived_at IS NULL
        AND expires_at IS NOT NULL AND expires_at <= now()
      RETURNING 1
  )
  SELECT count(*) INTO _archived FROM updated;

  RETURN QUERY SELECT _converted, _archived;
END;
$$;
REVOKE ALL ON FUNCTION public.process_live_class_lifecycle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_live_class_lifecycle() TO service_role, authenticated;
