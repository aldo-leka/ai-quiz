"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const supabase = createClientComponentClient();
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      // Redirect to host dashboard upon successful login
      router.push('/host');
      router.refresh();
    } catch (error: any) {
      setError(error.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDemoLogin = async () => {
    setEmail('demo@example.com');
    setPassword('password123');
    
    // In a real app, you would use actual demo credentials
    setLoading(true);
    
    // Simulate login delay
    setTimeout(() => {
      setLoading(false);
      router.push('/host');
    }, 1000);
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
            Sign In
          </h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Your email address"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Your password"
              />
            </div>
            
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
          
          <div className="mt-4">
            <button
              onClick={handleDemoLogin}
              className="w-full bg-gray-100 text-gray-800 border border-gray-300 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
            >
              Try Demo
            </button>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link href="/auth/register" className="text-indigo-600 hover:text-indigo-800">
                Create an account
              </Link>
            </p>
          </div>
          
          <div className="mt-4 text-center">
            <Link href="/auth/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-800">
              Forgot your password?
            </Link>
          </div>
          
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
