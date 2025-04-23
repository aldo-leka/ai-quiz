import supabase from './supabase';
import { User } from 'shared';

/**
 * Get a user by their ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }
    
    return data as User;
  } catch (error) {
    console.error('Error in getUserById:', error);
    return null;
  }
}

/**
 * Add credits to a user's account
 */
export async function addCreditsToUser(userId: string, credits: number): Promise<boolean> {
  try {
    // Get the current user
    const user = await getUserById(userId);
    
    if (!user) {
      return false;
    }
    
    // Update the user's credits
    const { error } = await supabase
      .from('users')
      .update({ credits: user.credits + credits })
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating user credits:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in addCreditsToUser:', error);
    return false;
  }
}

/**
 * Deduct credits from a user's account
 */
export async function deductCreditsFromUser(userId: string, credits: number): Promise<boolean> {
  try {
    // Get the current user
    const user = await getUserById(userId);
    
    if (!user) {
      return false;
    }
    
    // Check if the user has enough credits
    if (user.credits < credits) {
      return false;
    }
    
    // Update the user's credits
    const { error } = await supabase
      .from('users')
      .update({ credits: user.credits - credits })
      .eq('id', userId);
    
    if (error) {
      console.error('Error updating user credits:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deductCreditsFromUser:', error);
    return false;
  }
}

/**
 * Update a user's profile
 */
export async function updateUserProfile(userId: string, data: Partial<User>): Promise<User | null> {
  try {
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(data)
      .eq('id', userId)
      .select('*')
      .single();
    
    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }
    
    return updatedUser as User;
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return null;
  }
}
