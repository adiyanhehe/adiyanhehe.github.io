-- 1. PERSISTENT MESSAGE REACTIONS
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]';

-- 2. USER PRESENCE & LAST SEEN
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_type TEXT DEFAULT 'online' CHECK (status_type IN ('online', 'away', 'offline'));

-- 3. MESSAGE MENTIONS
CREATE TABLE IF NOT EXISTS message_mentions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    mentioned_username TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. READ RECEIPTS
CREATE TABLE IF NOT EXISTS read_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_name TEXT NOT NULL,
    channel_id TEXT NOT NULL, 
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_name, channel_id)
);

-- 5. ADVANCED MESSAGING FEATURES
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS link_preview JSONB;
-- Polls support
ALTER TABLE messages ADD COLUMN IF NOT EXISTS poll_data JSONB;

-- 6. CHANNEL CUSTOMIZATION & ROLES
ALTER TABLE groups ADD COLUMN IF NOT EXISTS custom_theme JSONB;
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member'));

-- 7. PROFILE ENHANCEMENTS
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_type TEXT DEFAULT 'initials'; -- 'initials' or 'image'

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_message_mentions_username ON message_mentions(mentioned_username);
CREATE INDEX IF NOT EXISTS idx_read_receipts_user_channel ON read_receipts(user_name, channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_messages_fulltext ON messages USING GIN (to_tsvector('english', content));

-- FUNCTION: Update last seen
CREATE OR REPLACE FUNCTION update_user_presence(username TEXT, status TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles 
    SET last_seen = NOW(), status_type = status
    WHERE username = username;
END;
$$ LANGUAGE plpgsql;

-- 8. SOCIAL & PERMISSIONS
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_user TEXT NOT NULL, -- User's username
    to_user TEXT NOT NULL,   -- Recipient's username
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(from_user, to_user)
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

-- REFRESH MESSAGE SEARCH INDEX (Optional, for better English search)
DROP INDEX IF EXISTS idx_messages_fulltext;
CREATE INDEX idx_messages_fulltext ON messages USING GIN (to_tsvector('english', COALESCE(content, '')));

-- DATA INTEGRITY: Ensure messages can refer to their parent channel easily
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
