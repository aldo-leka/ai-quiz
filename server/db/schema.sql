-- AI Quiz Game Database Schema
-- Copy and paste this SQL into Supabase SQL Editor to set up your tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Users table
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Quizzes table
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  theme TEXT NOT NULL,
  type TEXT NOT NULL,
  created_by_id UUID REFERENCES public.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  image_url TEXT,
  document_url TEXT
);

-- Create Questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  type TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_answer TEXT[] NOT NULL,
  explanation TEXT,
  time_limit INTEGER,
  image_url TEXT,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE NOT NULL
);

-- Create Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  host_id UUID REFERENCES public.users(id) NOT NULL,
  status TEXT DEFAULT 'lobby',
  quiz_id UUID REFERENCES public.quizzes(id),
  current_question_index INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  is_connected BOOLEAN DEFAULT true,
  is_host BOOLEAN DEFAULT false,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  socket_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(game_id, name)
);

-- Create Answers table
CREATE TABLE public.answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  answer TEXT[] NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_to_answer INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(player_id, question_id, game_id)
);

-- Create Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own quizzes" ON public.quizzes
  FOR SELECT USING (auth.uid() = created_by_id);

CREATE POLICY "Users can create their own quizzes" ON public.quizzes
  FOR INSERT WITH CHECK (auth.uid() = created_by_id);

CREATE POLICY "Public access to games" ON public.games
  FOR SELECT USING (true);

CREATE POLICY "Public access to players" ON public.players
  FOR SELECT USING (true);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, credits)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'avatar_url', 3);  -- Start with 3 free credits
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Add demo user - Uncomment and modify this to create a demo user if needed
/*
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES 
  ('00000000-0000-0000-0000-000000000000', 'demo@example.com', '{"name": "Demo User", "avatar_url": null}');

INSERT INTO public.users (id, email, name, credits) VALUES 
  ('00000000-0000-0000-0000-000000000000', 'demo@example.com', 'Demo User', 10);
*/

-- Set up Supabase Storage buckets
-- Note: These commands need to be run via the Supabase dashboard or API
/*
  1. Create a bucket named 'quiz-images'
  2. Create a bucket named 'quiz-documents'
  3. Set up appropriate RLS policies for these buckets
*/