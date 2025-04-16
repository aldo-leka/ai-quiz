import { Express } from 'express';

export function setupAuthRoutes(app: Express) {
  // Auth routes
  app.get('/api/auth/user', (req, res) => {
    // Get user from Supabase
    // This is a placeholder - will be implemented later
    res.status(200).json({ message: 'Not implemented yet' });
  });
}
