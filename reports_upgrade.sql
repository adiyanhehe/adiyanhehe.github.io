-- ============================================================
-- NEXUS REPORTS UPGRADE: SCHEMA ALIGNMENT
-- Run this in Supabase SQL Editor
-- ============================================================

-- Ensure the reports table has a status and resolved_by column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'status') THEN
    ALTER TABLE public.reports ADD COLUMN status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'resolved_by') THEN
    ALTER TABLE public.reports ADD COLUMN resolved_by TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'internal_notes') THEN
    ALTER TABLE public.reports ADD COLUMN internal_notes TEXT;
  END IF;
END $$;
