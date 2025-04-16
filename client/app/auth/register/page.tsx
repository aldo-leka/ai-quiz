"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const supabase = createClientComponentClient();
  
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    
    try {
      // Register user with Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });
      
      if (authError) {
        throw authError;
      }
      
      // Set initial credits for new user
      if (data?.user) {
        // In a real app, you would have a server-side function to handle this
        // For now, we'll just redirect to the host page
        console.log('User registered successfully:', data.user);
      }
      
      // Redirect to host dashboard upon successful registration
      router.push('/host');
      router.refresh();
    } catch (error: any) {
      setError(error.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
            Create Account
          </h1>
          
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Your full name"
              />
            </div>
            
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
                placeholder="Create a password"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Confirm your password"
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
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-800">
                Sign in
              </Link>
            </p>
          </div>
          
          <div className="mt-6 text-xs text-center text-gray-500">
            By creating an account, you agree to our <Link href="/terms" className="text-indigo-600 hover:text-indigo-800">Terms of Service</Link> and <Link href="/privacy" className="text-indigo-600 hover:text-indigo-800">Privacy Policy</Link>.
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
