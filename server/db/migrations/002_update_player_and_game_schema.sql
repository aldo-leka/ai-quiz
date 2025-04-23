-- Update the games table to make host_id optional and add socket_host_id column
ALTER TABLE public.games ALTER COLUMN host_id DROP NOT NULL;

-- Add user_id column to players table to link players to users
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);

-- Add host_disconnected_at column to games table to track when the host disconnected
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS host_disconnected_at TIMESTAMP WITH TIME ZONE;

-- Add an index to speed up lookups
CREATE INDEX IF NOT EXISTS idx_players_socket_id ON public.players(socket_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_games_socket_host_id ON public.games(socket_host_id);