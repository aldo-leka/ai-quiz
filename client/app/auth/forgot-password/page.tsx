"use client";

import { useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const supabase = createClientComponentClient();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    
    try {
      // Send password reset email via Supabase Auth
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      
      if (error) {
        throw error;
      }
      
      // Show success message
      setMessage('Check your email for a password reset link');
    } catch (error: any) {
      setError(error.message || 'An error occurred while sending reset email');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Forgot Password
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Enter your email and we'll send you a link to reset your password
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
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
            
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            
            {message && (
              <div className="text-green-500 text-sm">{message}</div>
            )}
            
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-800">
                Sign in
              </Link>
            </p>
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
