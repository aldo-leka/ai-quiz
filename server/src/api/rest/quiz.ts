import { Express } from 'express';
import { generateQuiz, generateQuizFromDocument, generateQuizThemes } from 'quiz-generator';
import { saveQuiz, getQuizById, getQuizzesByUserId } from '../../db/quizzes';
import { deductCreditsFromUser, addCreditsToUser } from '../../db/users';
import { authenticate } from './auth';

export function setupQuizRoutes(app: Express) {
  // Get all quizzes for a user
  app.get('/api/quiz', authenticate, async (req: any, res) => {
    try {
      const quizzes = await getQuizzesByUserId(req.user.id);
      res.status(200).json(quizzes);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      res.status(500).json({ message: 'Failed to fetch quizzes' });
    }
  });
  
  // Get a quiz by ID
  app.get('/api/quiz/:id', authenticate, async (req: any, res) => {
    try {
      const { id } = req.params;
      const quiz = await getQuizById(id);
      
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }
      
      res.status(200).json(quiz);
    } catch (error) {
      console.error('Error fetching quiz:', error);
      res.status(500).json({ message: 'Failed to fetch quiz' });
    }
  });
  
  // Generate and save a quiz
  app.post('/api/quiz/generate', authenticate, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { theme, type, questionCount, aiService, timeLimit } = req.body;
      
      // Check if the user has enough credits
      const hasEnoughCredits = await deductCreditsFromUser(userId, 1);
      
      if (!hasEnoughCredits) {
        return res.status(402).json({ message: 'Insufficient credits' });
      }
      
      // Generate a quiz
      const generatedQuiz = await generateQuiz({
        theme,
        type,
        questionCount: Math.min(questionCount, 15), // Cap at 15 questions
        aiService,
        timeLimit
      });
      
      // Add user ID to the quiz
      generatedQuiz.createdById = userId;
      
      // Save the quiz to the database
      const quizId = await saveQuiz(generatedQuiz);
      
      if (!quizId) {
        // Refund the credit if we failed to save
        await addCreditsToUser(userId, 1);
        return res.status(500).json({ message: 'Failed to save quiz' });
      }
      
      // Get the saved quiz with its ID
      const savedQuiz = await getQuizById(quizId);
      
      res.status(200).json(savedQuiz);
    } catch (error) {
      console.error('Error generating quiz:', error);
      res.status(500).json({ message: 'Failed to generate quiz' });
    }
  });
  
  // Generate and save a quiz from a document
  app.post('/api/quiz/generate-from-document', authenticate, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { documentUrl, questionCount, type, timeLimit } = req.body;
      
      // Check if the user has enough credits
      const hasEnoughCredits = await deductCreditsFromUser(userId, 2); // RAG costs more
      
      if (!hasEnoughCredits) {
        return res.status(402).json({ message: 'Insufficient credits' });
      }
      
      // Generate a quiz from a document
      const generatedQuiz = await generateQuizFromDocument({
        documentUrl,
        questionCount: Math.min(questionCount, 15), // Cap at 15 questions
        type,
        timeLimit // Include the timeLimit parameter
      });
      
      // Add user ID to the quiz
      generatedQuiz.createdById = userId;
      
      // Save the quiz to the database
      const quizId = await saveQuiz(generatedQuiz);
      
      if (!quizId) {
        // Refund the credits if we failed to save
        await addCreditsToUser(userId, 2);
        return res.status(500).json({ message: 'Failed to save quiz' });
      }
      
      // Get the saved quiz with its ID
      const savedQuiz = await getQuizById(quizId);
      
      res.status(200).json(savedQuiz);
    } catch (error) {
      console.error('Error generating quiz from document:', error);
      res.status(500).json({ message: 'Failed to generate quiz from document' });
    }
  });
  
  // Generate quiz themes
  app.post('/api/quiz/themes', authenticate, async (req: any, res) => {
    try {
      // Generate quiz themes
      const themes = await generateQuizThemes(req.body);
      res.status(200).json(themes);
    } catch (error) {
      console.error('Error generating quiz themes:', error);
      res.status(500).json({ message: 'Failed to generate quiz themes' });
    }
  });
}
