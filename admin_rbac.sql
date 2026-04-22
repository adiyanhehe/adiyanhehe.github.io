-- ============================================================
-- ADMIN PANEL RBAC + SECURITY HARDENING (SUPABASE)
-- Run this in Supabase SQL Editor AFTER your base schema.
--
-- Goals:
-- - Server-side RBAC (RLS) for admin actions
-- - Prevent banned users from creating content
-- - Allow admins/moderators to moderate users/messages/reports
--
-- Notes:
-- - This assumes you are using Supabase Auth.
-- - Your app already upserts profiles with profiles.id = auth.uid().
-- ============================================================

-- 1) PROFILES: add role + ban status normalization
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'user'));

-- Keep legacy is_admin in sync (best-effort)
UPDATE public.profiles
SET role = 'admin'
WHERE COALESCE(is_admin, false) = true AND role <> 'admin';

-- 2) HELPERS
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(p.role, CASE WHEN COALESCE(p.is_admin,false) THEN 'admin' ELSE 'user' END)
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_profile_role() IN ('admin', 'moderator');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.current_profile_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_banned()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND UPPER(COALESCE(p.status, '')) = 'BANNED'
  );
$$;

-- 3) RLS: PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- Allow reading profiles for app UI
CREATE POLICY "profiles_select_public"
ON public.profiles
FOR SELECT
USING (true);

-- Allow inserting own profile (must match auth user)
CREATE POLICY "profiles_insert_self"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND id = auth.uid());

-- Allow updating own profile (non-admin fields)
CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
USING (auth.uid() IS NOT NULL AND id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND id = auth.uid());

-- Staff can update anyone (ban/role/admin)
CREATE POLICY "profiles_update_staff"
ON public.profiles
FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Admin can delete profile rows (note: does NOT delete Supabase Auth users)
CREATE POLICY "profiles_delete_admin"
ON public.profiles
FOR DELETE
USING (public.is_admin());

-- 4) RLS: MESSAGES
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
DROP POLICY IF EXISTS "Users can update status of messages they received" ON public.messages;

-- Allow reading messages for the app. If you want strict privacy later, tighten this policy.
CREATE POLICY "messages_select_authenticated"
ON public.messages
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only authenticated + not banned can insert
CREATE POLICY "messages_insert_authenticated_not_banned"
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_banned());

-- Sender can update their own messages; staff can update any (e.g. mark edited/pinned)
CREATE POLICY "messages_update_sender_or_staff"
ON public.messages
FOR UPDATE
USING (public.is_staff() OR sender = (SELECT username FROM public.profiles WHERE id = auth.uid()));

-- Sender can delete their own messages; staff can delete any
CREATE POLICY "messages_delete_sender_or_staff"
ON public.messages
FOR DELETE
USING (public.is_staff() OR sender = (SELECT username FROM public.profiles WHERE id = auth.uid()));

-- 5) RLS: THREADS
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public threads" ON public.threads;

CREATE POLICY "threads_select_public"
ON public.threads
FOR SELECT
USING (true);

CREATE POLICY "threads_insert_authenticated_not_banned"
ON public.threads
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_banned());

CREATE POLICY "threads_update_owner_or_staff"
ON public.threads
FOR UPDATE
USING (public.is_staff() OR author = (SELECT username FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "threads_delete_owner_or_staff"
ON public.threads
FOR DELETE
USING (public.is_staff() OR author = (SELECT username FROM public.profiles WHERE id = auth.uid()));

-- 6) RLS: REPORTS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public reports" ON public.reports;

-- Anyone authenticated can file a report (not banned)
CREATE POLICY "reports_insert_authenticated_not_banned"
ON public.reports
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_banned());

-- Only staff can see reports
CREATE POLICY "reports_select_staff"
ON public.reports
FOR SELECT
USING (public.is_staff());

-- Only staff can update/resolve reports
CREATE POLICY "reports_update_staff"
ON public.reports
FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- Only admin can delete reports
CREATE POLICY "reports_delete_admin"
ON public.reports
FOR DELETE
USING (public.is_admin());

