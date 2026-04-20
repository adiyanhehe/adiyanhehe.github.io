-- ============================================
-- SUPABASE DATABASE SETUP FOR NEXUS
-- ============================================

-- Message Status Table (for tracking sent/delivered/read status)
CREATE TABLE IF NOT EXISTS message_status (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- sent, delivered, read
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Messages Table (for offline delivery and persistence)
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- sent, delivered, read
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    INDEX idx_sender_recipient (sender_id, recipient_id),
    INDEX idx_recipient_status (recipient_id, status)
);

-- ============================================
-- Run this SQL in your Supabase SQL Editor to create all required tables

-- First, drop existing tables if they exist (to ensure clean setup)
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS friend_requests CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. PROFILES TABLE (User data)
CREATE TABLE profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT DEFAULT 'No bio available',
    status TEXT DEFAULT 'Online',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. FRIEND REQUESTS TABLE
CREATE TABLE friend_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_user, to_user)
);

-- 3. POSTS TABLE (For Threads)
CREATE TABLE posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    avatar_url TEXT,
    likes INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MESSAGES TABLE (For Chat/Discuss)
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender TEXT NOT NULL,
    receiver TEXT,
    content TEXT NOT NULL,
    channel_type TEXT DEFAULT 'direct' CHECK (channel_type IN ('direct', 'group')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. REPORTS TABLE (For moderation)
CREATE TABLE reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    content_data JSONB,
    reason TEXT NOT NULL,
    reporter TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. GROUPS TABLE (For group chats)
CREATE TABLE groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. GROUP MEMBERS TABLE
CREATE TABLE group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_name)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Allow all operations (custom auth system handles security)
CREATE POLICY "Allow all on profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on friend_requests" ON friend_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on posts" ON posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reports" ON reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on group_members" ON group_members FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_friend_requests_from_user ON friend_requests(from_user);
CREATE INDEX idx_friend_requests_to_user ON friend_requests(to_user);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);
CREATE INDEX idx_posts_author ON posts(author);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender);
CREATE INDEX idx_messages_receiver ON messages(receiver);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_groups_owner ON groups(owner);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_name ON group_members(user_name);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friend_requests_updated_at BEFORE UPDATE ON friend_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CLEANUP FUNCTIONS (For admin use)
-- ============================================

-- Function to clear old messages (older than N days)
CREATE OR REPLACE FUNCTION clear_old_messages(days_old INTEGER)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM messages 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_name TEXT)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'posts', (SELECT COUNT(*) FROM posts WHERE author = user_name),
        'friends', (SELECT COUNT(*) FROM friend_requests WHERE (from_user = user_name OR to_user = user_name) AND status = 'accepted'),
        'messages_sent', (SELECT COUNT(*) FROM messages WHERE sender = user_name),
        'groups', (SELECT COUNT(*) FROM group_members WHERE user_name = user_name)
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;