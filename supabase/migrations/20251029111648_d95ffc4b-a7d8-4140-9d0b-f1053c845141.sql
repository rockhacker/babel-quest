-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Allow users to view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);

-- Only admins can manage roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Fix RLS policies for admin_sessions (restrict to service role only)
DROP POLICY IF EXISTS "Allow all operations" ON public.admin_sessions;

CREATE POLICY "Service role only" ON public.admin_sessions
USING (false);

-- Fix RLS policies for export_jobs (authenticated users only)
DROP POLICY IF EXISTS "Allow all operations" ON public.export_jobs;

CREATE POLICY "Authenticated users view exports" ON public.export_jobs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users create exports" ON public.export_jobs
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users update exports" ON public.export_jobs
FOR UPDATE TO authenticated USING (true);

-- Fix RLS policies for brands (public read, authenticated write)
DROP POLICY IF EXISTS "Allow all operations" ON public.brands;

CREATE POLICY "Public read brands" ON public.brands
FOR SELECT USING (true);

CREATE POLICY "Authenticated modify brands" ON public.brands
FOR ALL TO authenticated USING (true);

-- Fix RLS policies for types (public read, authenticated write)
DROP POLICY IF EXISTS "Allow all operations" ON public.types;

CREATE POLICY "Public read types" ON public.types
FOR SELECT USING (true);

CREATE POLICY "Authenticated modify types" ON public.types
FOR ALL TO authenticated USING (true);

-- Fix RLS policies for originals (public read, authenticated write)
DROP POLICY IF EXISTS "Allow all operations" ON public.originals;

CREATE POLICY "Public read originals" ON public.originals
FOR SELECT USING (true);

CREATE POLICY "Authenticated modify originals" ON public.originals
FOR ALL TO authenticated USING (true);

-- Fix RLS policies for replicas (public read, authenticated write)
DROP POLICY IF EXISTS "Allow all operations" ON public.replicas;

CREATE POLICY "Public read replicas" ON public.replicas
FOR SELECT USING (true);

CREATE POLICY "Authenticated modify replicas" ON public.replicas
FOR ALL TO authenticated USING (true);

-- Fix RLS policies for batches (public read, authenticated write)
DROP POLICY IF EXISTS "Allow all operations" ON public.batches;

CREATE POLICY "Public read batches" ON public.batches
FOR SELECT USING (true);

CREATE POLICY "Authenticated modify batches" ON public.batches
FOR ALL TO authenticated USING (true);

-- Make exports bucket private
UPDATE storage.buckets 
SET public = false 
WHERE name = 'exports';

-- Add RLS policies for storage.objects (exports bucket)
CREATE POLICY "Authenticated users read exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'exports');

CREATE POLICY "Authenticated users upload exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'exports');

CREATE POLICY "Authenticated users update exports"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'exports');

CREATE POLICY "Authenticated users delete exports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'exports');

-- Add columns to export_jobs for signed URLs
ALTER TABLE public.export_jobs 
ADD COLUMN IF NOT EXISTS signed_url text,
ADD COLUMN IF NOT EXISTS url_expires_at timestamptz;