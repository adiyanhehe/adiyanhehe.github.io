-- ============================================================
-- DISCUSS.HTML BACKEND MIGRATION
-- Run this in your Supabase SQL Editor: https://app.supabase.com
-- ============================================================

-- 1. Add 'reactions' column to messages (for emoji reaction support)
--    reactions are stored as JSON: [{ "emoji": "👍", "users": ["username1"] }]
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]';

-- 1b. Add 'gif_url' column to messages for Giphy integration
ALTER TABLE messages ADD COLUMN IF NOT EXISTS gif_url TEXT;

-- 2. Add missing columns to profiles that global.js/discuss.js reference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin    BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pronouns    TEXT;

-- 3. Ensure the 'status' column exists on profiles (used for presence text)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ready to chat';

-- 4. Enable Row-Level Security for public access (already done if you ran supabase-setup.sql)
--    Run these only if not already enabled:
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);

-- 5. Enable Supabase Realtime for the messages table
--    This allows discuss.js to receive live INSERT events.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 6. Also enable realtime for profiles (for online presence tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- 7. Verify your tables look correct:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles';
