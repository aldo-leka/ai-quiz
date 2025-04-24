-- Migration: Fix user trigger for Supabase
-- Description: Drops and recreates user creation trigger to work with Supabase's auth schema

-- First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Then drop the existing function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  username TEXT;
  user_avatar TEXT;
BEGIN
  -- Get the user's name from metadata
  username := COALESCE((new.raw_user_meta_data->>'name')::TEXT, 'New User');
  
  -- Get the user's avatar from metadata
  user_avatar := (new.raw_user_meta_data->>'avatar_url')::TEXT;
  
  -- Create the user record
  INSERT INTO public.users (id, email, name, avatar_url, credits)
  VALUES (
    new.id,
    new.email,
    username,
    user_avatar,
    3  -- Start with 3 free credits
  );
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the transaction
  RAISE LOG 'Error in handle_new_user: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to execute the function
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();