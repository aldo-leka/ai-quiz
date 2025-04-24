"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User } from 'shared';
import { getCurrentUser, signOut } from '@/lib/supabase/auth';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Skip header on certain pages
  const hideHeaderPaths = [
    '/',
    '/join',
    '/game',
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
  ];
  
  const shouldShowHeader = !hideHeaderPaths.includes(pathname || '');
  
  useEffect(() => {
    async function loadUser() {
      if (shouldShowHeader) {
        const userData = await getCurrentUser();
        setUser(userData);
        setIsLoading(false);
      }
    }
    
    loadUser();
  }, [shouldShowHeader]);
  
  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  if (!shouldShowHeader) {
    return null;
  }
  
  return (
    <header className="bg-white shadow-sm py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text hover:from-indigo-500 hover:to-purple-500 transition-all">QuizPlus.io</Link>
        
        <nav className="hidden md:block">
          <ul className="flex space-x-6">
            <li>
              <Link 
                href="/host"
                className={`text-gray-600 hover:text-indigo-600 ${pathname === '/host' ? 'text-indigo-600 font-medium' : ''}`}
              >
                Host
              </Link>
            </li>
            {user && (
              <>
                <li>
                  <Link 
                    href="/host/dashboard"
                    className={`text-gray-600 hover:text-indigo-600 ${pathname === '/host/dashboard' ? 'text-indigo-600 font-medium' : ''}`}
                  >
                    My Quizzes
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/host/credits"
                    className={`text-gray-600 hover:text-indigo-600 ${pathname === '/host/credits' ? 'text-indigo-600 font-medium' : ''}`}
                  >
                    Credits ({user.credits})
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
        
        <div className="hidden md:block">
          {isLoading ? (
            <div className="w-20 h-6 bg-gray-200 rounded animate-pulse"></div>
          ) : user ? (
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{user.name}</span>
              <button 
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-indigo-600"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link 
              href="/auth/login"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Sign In
            </Link>
          )}
        </div>
        
        {/* Mobile menu button */}
        <button 
          className="md:hidden text-gray-600"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
        </button>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white pb-4 px-4">
          <nav>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/host"
                  className={`block py-2 text-gray-600 hover:text-indigo-600 ${pathname === '/host' ? 'text-indigo-600 font-medium' : ''}`}
                >
                  Host
                </Link>
              </li>
              {user ? (
                <>
                  <li>
                    <Link 
                      href="/host/dashboard"
                      className={`block py-2 text-gray-600 hover:text-indigo-600 ${pathname === '/host/dashboard' ? 'text-indigo-600 font-medium' : ''}`}
                    >
                      My Quizzes
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/host/credits"
                      className={`block py-2 text-gray-600 hover:text-indigo-600 ${pathname === '/host/credits' ? 'text-indigo-600 font-medium' : ''}`}
                    >
                      Credits ({user.credits})
                    </Link>
                  </li>
                  <li>
                    <button 
                      onClick={handleSignOut}
                      className="block w-full text-left py-2 text-gray-600 hover:text-indigo-600"
                    >
                      Sign Out
                    </button>
                  </li>
                </>
              ) : (
                <li>
                  <Link 
                    href="/auth/login"
                    className="block py-2 text-indigo-600 font-medium"
                  >
                    Sign In
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}