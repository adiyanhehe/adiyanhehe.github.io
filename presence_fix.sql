-- ============================================================
-- PRESENCE SYSTEM BUG FIX
-- Run this in your Supabase SQL Editor: https://app.supabase.com
-- This fixes the 'username = username' bug in the presence function.
-- ============================================================

DROP FUNCTION IF EXISTS update_user_presence(text, text);

CREATE OR REPLACE FUNCTION update_user_presence(username TEXT, status TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles 
    SET last_seen = NOW(), status_type = status
    WHERE profiles.username = update_user_presence.username;
END;
$$ LANGUAGE plpgsql;

-- Verify the column exists as well
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_type TEXT DEFAULT 'online' CHECK (status_type IN ('online', 'away', 'offline'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Enable realtime for profiles (Handled by MASTER_DATABASE_SETUP, ignore if error occurs)
-- ALTER PUBLICATION supabase_realtime ADD TABLE profiles; 
