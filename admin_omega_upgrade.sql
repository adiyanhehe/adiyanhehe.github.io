-- ============================================================
-- NEXUS OMEGA UPGRADE: DATA DEPTH + MODERATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1) Expand Profiles for Moderation Context
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS strike_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

-- 2) Update Permission Helpers to consider new columns
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND (role IN ('admin', 'moderator') OR is_admin = true)
      AND UPPER(status) != 'BANNED'
  );
$$;

-- 3) Auto-Update last_active trigger
CREATE OR REPLACE FUNCTION public.handle_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET last_active = NOW() WHERE id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Apply activity tracking to messages and threads
DROP TRIGGER IF EXISTS on_message_activity ON public.messages;
CREATE TRIGGER on_message_activity
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_activity();

DROP TRIGGER IF EXISTS on_thread_activity ON public.threads;
CREATE TRIGGER on_thread_activity
  AFTER INSERT ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_activity();
