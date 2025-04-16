"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from 'shared';
import { getCurrentUser } from '@/lib/supabase/auth';

export default function HostGame() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  
  // Load user on component mount
  useEffect(() => {
    async function loadUser() {
      const userData = await getCurrentUser();
      setUser(userData);
      setIsLoading(false);
    }
    
    loadUser();
  }, []);
  
  const handleCreateGame = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    
    setIsCreatingGame(true);
    // Navigate to the create quiz page
    router.push('/host/create');
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
            Host a Quiz Game
          </h1>
          
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ) : user ? (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-800">
                  You have {user.credits} credits remaining. Each quiz costs 1 credit.
                </p>
              </div>
              
              <button
                onClick={handleCreateGame}
                disabled={isCreatingGame || user.credits < 1}
                className="w-full bg-indigo-600 text-white py-3 rounded-md text-center font-medium hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
              >
                {isCreatingGame ? 'Loading...' : user.credits < 1 ? 'Not Enough Credits' : 'Create New Quiz'}
              </button>
              
              <Link 
                href="/host/dashboard"
                className="block w-full bg-white text-indigo-600 border border-indigo-600 py-3 rounded-md text-center font-medium hover:bg-indigo-50 transition-colors"
              >
                My Quizzes
              </Link>
              
              <Link 
                href="/host/credits"
                className="block w-full bg-white text-indigo-600 border border-indigo-600 py-3 rounded-md text-center font-medium hover:bg-indigo-50 transition-colors"
              >
                Buy Credits
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-center text-gray-600 mb-4">
                Sign in to create and host your own AI-generated quiz games!
              </p>
              
              <Link 
                href="/auth/login"
                className="block w-full bg-indigo-600 text-white py-3 rounded-md text-center font-medium hover:bg-indigo-700 transition-colors"
              >
                Sign In
              </Link>
              
              <Link 
                href="/auth/register"
                className="block w-full bg-white text-indigo-600 border border-indigo-600 py-3 rounded-md text-center font-medium hover:bg-indigo-50 transition-colors"
              >
                Create Account
              </Link>
            </div>
          )}
          
          <div className="mt-8">
            <Link 
              href="/"
              className="block text-center text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
