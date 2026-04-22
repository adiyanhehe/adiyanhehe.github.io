-- ============================================================
-- ADMIN EXTRAS: audit log + system settings
-- Run this AFTER admin_rbac.sql
-- ============================================================

-- 1) AUDIT LOG TABLE (server-side, replaces localStorage admin_actions)
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,                 -- auth.uid()
  actor_username TEXT,           -- profiles.username snapshot
  action TEXT NOT NULL,
  target TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_actions_select_staff" ON public.admin_actions;
CREATE POLICY "admin_actions_select_staff"
ON public.admin_actions
FOR SELECT
USING (public.is_staff());

DROP POLICY IF EXISTS "admin_actions_insert_staff" ON public.admin_actions;
CREATE POLICY "admin_actions_insert_staff"
ON public.admin_actions
FOR INSERT
WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "admin_actions_delete_admin" ON public.admin_actions;
CREATE POLICY "admin_actions_delete_admin"
ON public.admin_actions
FOR DELETE
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON public.admin_actions(created_at DESC);

-- 2) SYSTEM SETTINGS (feature toggles)
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_select_public" ON public.system_settings;
CREATE POLICY "system_settings_select_public"
ON public.system_settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "system_settings_upsert_admin" ON public.system_settings;
CREATE POLICY "system_settings_upsert_admin"
ON public.system_settings
FOR INSERT
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "system_settings_update_admin" ON public.system_settings;
CREATE POLICY "system_settings_update_admin"
ON public.system_settings
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Seed defaults (safe upserts)
INSERT INTO public.system_settings(key, value)
VALUES
  ('features', jsonb_build_object(
    'enable_threads', true,
    'enable_global_chat', true,
    'enable_friend_requests', true,
    'enable_gifs', true,
    'maintenance_mode', false
  ))
ON CONFLICT (key) DO NOTHING;

