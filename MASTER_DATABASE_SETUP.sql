-- ============================================================
-- MASTER DATABASE SETUP FOR PULSE / NEXUS
-- Run this in your Supabase SQL Editor: https://app.supabase.com
-- ============================================================

-- 1. CLEANUP (Optional: Uncomment to reset everything if starting fresh)
-- DROP TABLE IF EXISTS group_members CASCADE;
-- DROP TABLE IF EXISTS groups CASCADE;
-- DROP TABLE IF EXISTS reports CASCADE;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS friend_requests CASCADE;
-- DROP TABLE IF EXISTS threads CASCADE;
-- DROP TABLE IF EXISTS posts CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    bio TEXT DEFAULT 'New entity detected.',
    status TEXT DEFAULT 'Ready to chat',
    pronouns TEXT,
    is_admin BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MESSAGES TABLE
-- Supports DMs, Group Chats, and Global Chat via receiver column
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender TEXT NOT NULL, -- User Name
    receiver TEXT NOT NULL, -- User Name, Group UUID, or 'global_chat'
    content TEXT,
    gif_url TEXT,
    reactions JSONB DEFAULT '[]', -- Format: [{"emoji": "👍", "users": ["username"]}]
    channel_type TEXT DEFAULT 'direct' CHECK (channel_type IN ('direct', 'group', 'global')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FRIEND REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_user, to_user)
);

-- 5. POSTS / THREADS TABLE
-- Some components use 'posts', others use 'threads'. We create both.
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    avatar_url TEXT,
    likes INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creating a matching threads table for components that expect it
CREATE TABLE IF NOT EXISTS public.threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    avatar TEXT,
    media_url TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    likes INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0
);

-- 6. GROUPS & MEMBERS
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    owner TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_name)
);

-- 7. REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_data JSONB,
    reason TEXT NOT NULL,
    reporter TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. FOLLOWS TABLE
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower TEXT NOT NULL, -- Username
    following TEXT NOT NULL, -- Username
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower, following)
);

-- ============================================================
-- SECURITY POLICIES (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Allow public access (custom auth system handles user validation in JS)
DROP POLICY IF EXISTS "Public follows" ON follows;
CREATE POLICY "Public follows" ON follows FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public profiles" ON profiles;
CREATE POLICY "Public profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public friend requests" ON friend_requests;
CREATE POLICY "Public friend requests" ON friend_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public messages" ON messages;
CREATE POLICY "Public messages" ON messages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public posts" ON posts;
CREATE POLICY "Public posts" ON posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public threads" ON threads;
CREATE POLICY "Public threads" ON threads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public groups" ON groups;
CREATE POLICY "Public groups" ON groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public group_members" ON group_members;
CREATE POLICY "Public group_members" ON group_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public reports" ON reports;
CREATE POLICY "Public reports" ON reports FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- REALTIME SETUP
-- ============================================================

-- Enable Supabase Realtime for live chat functionality
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE messages, profiles, friend_requests, posts, threads;
COMMIT;

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_threads_author ON threads(author);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- 8. RPC FUNCTIONS (For performance)
CREATE OR REPLACE FUNCTION increment_likes(thread_id UUID, delta INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE threads SET likes = COALESCE(likes, 0) + delta WHERE id = thread_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_reposts(thread_id UUID, delta INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE threads SET reposts = COALESCE(reposts, 0) + delta WHERE id = thread_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. ANOMALOUS OPERATIONS (MODULE 05)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_username TEXT NOT NULL,
    target_username TEXT NOT NULL,
    action_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_username);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize or update configuration
INSERT INTO system_settings (key, value)
VALUES ('anomalous_ops_config', '{"kill_switch": false, "cooldown_ms": 5000}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public audit log" ON admin_audit_log;
CREATE POLICY "Public audit log" ON admin_audit_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public system settings" ON system_settings;
CREATE POLICY "Public system settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);

