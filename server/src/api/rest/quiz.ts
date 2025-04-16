import { Express } from 'express';
import { generateQuiz, generateQuizFromDocument, generateQuizThemes } from 'quiz-generator';

export function setupQuizRoutes(app: Express) {
  // Quiz routes
  app.post('/api/quiz/generate', async (req, res) => {
    try {
      // Generate a quiz
      const quiz = await generateQuiz(req.body);
      res.status(200).json(quiz);
    } catch (error) {
      console.error('Error generating quiz:', error);
      res.status(500).json({ message: 'Failed to generate quiz' });
    }
  });
  
  app.post('/api/quiz/generate-from-document', async (req, res) => {
    try {
      // Generate a quiz from a document
      const quiz = await generateQuizFromDocument(req.body);
      res.status(200).json(quiz);
    } catch (error) {
      console.error('Error generating quiz from document:', error);
      res.status(500).json({ message: 'Failed to generate quiz from document' });
    }
  });
  
  app.post('/api/quiz/themes', async (req, res) => {
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
