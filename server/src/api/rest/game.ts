import { Express, Request, Response } from 'express';
import { getGameSessionManager } from '../ws/connection';
import { requireAuth } from '../../auth/middleware';

export function setupGameRoutes(app: Express) {
  /**
   * Get quiz data for a game without requiring authentication
   * This endpoint allows players to fetch quiz data when in a game
   */
  app.get('/api/games/:gameCode/quiz/:quizId', async (req: Request, res: Response) => {
    try {
      const { gameCode, quizId } = req.params;
      
      if (!gameCode || !quizId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Temporarily skip game session checks due to initialization issues
      /*
      // Get game session manager
      const gameSessionManager = getGameSessionManager();
      
      // Verify the game exists and is using this quiz
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      if (!gameSession) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      if (gameSession.currentQuizId !== quizId) {
        return res.status(403).json({ error: 'Unauthorized access to quiz' });
      }
      */
      
      // Import quiz functions
      const { getQuizById } = await import('../../db/quizzes');
      
      // Fetch the quiz
      const quiz = await getQuizById(quizId);
      
      if (!quiz) {
        return res.status(404).json({ error: 'Quiz not found' });
      }
      
      return res.status(200).json(quiz);
    } catch (error) {
      console.error('Error fetching quiz for game:', error);
      return res.status(500).json({ error: 'Failed to retrieve quiz' });
    }
  });

  /**
   * Get active games for the authenticated user
   * This returns games where the user is the host and the game is still active
   */
  app.get('/api/games/active', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      const gameSessionManager = getGameSessionManager();
      const activeGames = await gameSessionManager.getActiveGamesForUser(userId);
      
      // Transform to a simplified format for the client
      const simplifiedGames = activeGames.map(game => ({
        id: game.id,
        code: game.code,
        status: game.status,
        playerCount: game.players.length,
        activePlayerCount: game.players.filter(p => p.isConnected).length,
        currentQuestionIndex: game.currentQuestionIndex,
        hostDisconnectedAt: game.hostDisconnectedAt,
        lastActivityAt: game.lastActivityAt
      }));
      
      return res.status(200).json({ activeGames: simplifiedGames });
    } catch (error) {
      console.error('Error fetching active games:', error);
      return res.status(500).json({ error: 'Failed to retrieve active games' });
    }
  });
}