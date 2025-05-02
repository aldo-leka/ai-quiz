import { Express } from 'express';
import { setupAuthRoutes } from './auth';
import { setupQuizRoutes } from './quiz';
import { setupPaymentRoutes } from './payments';
import { setupGameRoutes } from './game';

export function setupRoutes(app: Express) {
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // Debug route to get all active game sessions
  app.get('/debug/sessions', (req, res) => {
    try {
      const { getAllSessions } = require('../ws/gameMonolith');
      const sessions = getAllSessions();
      
      // Calculate session age and inactivity time
      const now = new Date().getTime();
      
      // Map sessions to a more readable format
      const simplifiedSessions = sessions.map(session => {
        const createdAt = session.createdAt ? new Date(session.createdAt).getTime() : now;
        const lastActivityAt = session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : now;
        
        const ageMinutes = Math.floor((now - createdAt) / (1000 * 60));
        const inactiveMinutes = Math.floor((now - lastActivityAt) / (1000 * 60));
        
        return {
          code: session.code,
          status: session.status,
          hostId: session.hostId,
          playerCount: session.players.length,
          players: session.players.map(p => ({
            id: p.id,
            name: p.name,
            isHost: p.isHost,
            isConnected: p.isConnected
          })),
          currentQuestionIndex: session.currentQuestionIndex,
          createdAt: session.createdAt,
          lastActivityAt: session.lastActivityAt,
          ageMinutes,
          inactiveMinutes,
          // When this session will expire (in minutes)
          expiresInMinutes: Math.max(0, 180 - inactiveMinutes) // Assuming 3-hour timeout
        };
      });
      
      res.status(200).json(simplifiedSessions);
    } catch (error) {
      console.error('Error in debug endpoint:', error);
      res.status(500).json({ error: 'Failed to retrieve sessions' });
    }
  });
  
  // Setup API routes
  setupAuthRoutes(app);
  setupQuizRoutes(app);
  setupPaymentRoutes(app);
  setupGameRoutes(app);
}
