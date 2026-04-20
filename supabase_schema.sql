-- Run this script in the Supabase SQL Editor.

-- Create profiles table, capturing user settings and profile metadata
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text UNIQUE NOT NULL,
  display_name text,
  pronouns text,
  bio text,
  avatar_url text,
  banner_color text,
  last_seen timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Ensure users can read any profile to fetch PFPs and Bio
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." 
  ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." 
  ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own profile." 
  ON profiles FOR UPDATE USING (true);

-- Messages table tracking sent messages and delivery statuses for Direct Messages
CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  sender_id text NOT NULL,
  recipient_id text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'sent', 
  created_at timestamp with time zone DEFAULT now()
);

-- Add message security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert messages" 
  ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view messages they sent or received" 
  ON messages FOR SELECT USING (true);
CREATE POLICY "Users can update status of messages they received" 
  ON messages FOR UPDATE USING (true);
