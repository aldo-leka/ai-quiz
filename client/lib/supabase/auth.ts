import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from 'shared';

// Get the current user from Supabase Auth
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClientComponentClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }
    
    // Fetch additional user data from the database
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error || !data) {
      console.error('Error fetching user data:', error);
      return null;
    }
    
    return {
      id: user.id,
      email: user.email || '',
      name: data.name || user.user_metadata.name || '',
      avatar_url: data.avatar_url || user.user_metadata.avatar_url,
      credits: data.credits || 0,
      created_at: data.created_at || user.created_at,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Sign out the current user
export async function signOut(): Promise<void> {
  const supabase = createClientComponentClient();
  
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
}
