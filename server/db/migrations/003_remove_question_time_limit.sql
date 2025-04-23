-- Migration to remove the time_limit column from questions table
-- This simplifies the quiz timing logic by only using the time_limit on the quizzes table

-- First, update the prisma schema if you're using prisma (separate step after running this migration)
-- Then remove the column from the database
ALTER TABLE public.questions DROP COLUMN IF EXISTS time_limit;

-- Add a comment to the quizzes table time_limit column to clarify its purpose
COMMENT ON COLUMN public.quizzes.time_limit IS 'Time limit in seconds for each question in this quiz';