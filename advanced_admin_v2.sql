-- NEXUS ADVANCED ADMINISTRATIVE EXPANSION
-- Run this in the Supabase SQL Editor to enable new features.

-- 1. ADD STRIKE SYSTEM & GHOST MODE
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS strikes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ghost_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 2. CREATE SYSTEM LOGS FOR TROLL ACTIONS (Audit Trail)
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_username TEXT NOT NULL,
    target_username TEXT NOT NULL,
    action_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENABLE RLS FOR AUDIT LOGS (Only Admins can see)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" 
ON admin_audit_log FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.role = 'admin' OR profiles.is_admin = true)
    )
);

-- 4. UPDATE SYSTEM SETTINGS FOR NEW GLOBAL FLAGS
-- This allows admins to toggle platform-wide behaviors
INSERT INTO system_settings (key, value)
VALUES ('platform_config', '{
    "global_announcement": "",
    "announcement_type": "info",
    "lockdown_mode": false,
    "slow_mode_seconds": 0
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
