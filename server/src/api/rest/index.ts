import { Express } from 'express';
import { setupAuthRoutes } from './auth';
import { setupQuizRoutes } from './quiz';
import { setupPaymentRoutes } from './payments';

export function setupRoutes(app: Express) {
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // Setup API routes
  setupAuthRoutes(app);
  setupQuizRoutes(app);
  setupPaymentRoutes(app);
}
