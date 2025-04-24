-- Migration: 005_add_quiz_difficulty.sql
-- Description: Add difficulty column to quizzes table
-- Date: 2025-04-24

-- Add difficulty column to quizzes table with default value of 'intermediate'
ALTER TABLE public.quizzes 
ADD COLUMN difficulty VARCHAR(20) DEFAULT 'intermediate';

-- Update existing quizzes based on theme or other attributes
-- This is a basic approach; we set all existing quizzes to 'intermediate'
UPDATE public.quizzes
SET difficulty = 'intermediate'
WHERE difficulty IS NULL;

-- Comment on the new column
COMMENT ON COLUMN public.quizzes.difficulty IS 'Difficulty level of the quiz (beginner, intermediate, advanced)';