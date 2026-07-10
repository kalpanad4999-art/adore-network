ALTER TABLE public.studio_settings ALTER COLUMN studio_name SET DEFAULT 'TRINETRA YOGA';
UPDATE public.studio_settings SET studio_name = 'TRINETRA YOGA' WHERE studio_name = 'TRINETRA';