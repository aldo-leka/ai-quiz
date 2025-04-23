-- This migration adds the necessary database functions to support transactions
-- It also adds the last_activity_at column to games table for session tracking

-- Add last_activity_at column to games table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add socket_id column to games table for host
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS socket_host_id TEXT;

-- Functions for transaction support
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.transaction_id', gen_random_uuid()::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.transaction_id', NULL, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.transaction_id', NULL, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add time_limit to quizzes table if it doesn't exist
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS time_limit INTEGER;