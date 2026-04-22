-- MODULE 05: ANOMALOUS OPERATIONS - DATABASE SCHEMA (ALIGNED)
-- This script ensures the audit logging and configuration for the Troll Suite are compatible with the existing schema.

-- 1. Align the audit log table
-- If it exists from advanced_admin_v2.sql, we match its columns or add missing ones.
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_username TEXT NOT NULL,
    target_username TEXT NOT NULL,
    action_type TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure we have the 'metadata' column if the table was created differently
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='metadata') THEN
        ALTER TABLE admin_audit_log ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- 2. Indexing for fast lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_username);

-- 3. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize or update configuration
INSERT INTO system_settings (key, value)
VALUES ('anomalous_ops_config', '{"kill_switch": false, "cooldown_ms": 5000}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;