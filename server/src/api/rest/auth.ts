import { Express } from 'express';
import supabase from '../../db/supabase';
import { getUserById, updateUserProfile } from '../../db/users';

// Extract and validate JWT from request
const extractToken = (req: any): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
};

// Middleware to authenticate requests
export const authenticate = async (req: any, res: any, next: any) => {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    
    // Attach the user to the request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export function setupAuthRoutes(app: Express) {
  // Get current user profile
  app.get('/api/auth/user', authenticate, async (req: any, res) => {
    try {
      const user = await getUserById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });
  
  // Update user profile
  app.post('/api/auth/user', authenticate, async (req: any, res) => {
    try {
      const { name, avatar_url } = req.body;
      
      const updatedUser = await updateUserProfile(req.user.id, {
        name,
        avatar_url
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'Failed to update user' });
      }
      
      res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });
  
  // Get user credits
  app.get('/api/auth/credits', authenticate, async (req: any, res) => {
    try {
      const user = await getUserById(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.status(200).json({ credits: user.credits });
    } catch (error) {
      console.error('Error fetching credits:', error);
      res.status(500).json({ message: 'Failed to fetch credits' });
    }
  });
}
