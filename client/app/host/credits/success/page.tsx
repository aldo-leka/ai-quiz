"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from 'shared';
import { getCurrentUser } from '@/lib/supabase/auth';

export default function PaymentSuccess() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load user on component mount
  useEffect(() => {
    async function loadUser() {
      const userData = await getCurrentUser();
      if (!userData) {
        // Redirect to login if not authenticated
        router.push('/auth/login');
        return;
      }
      
      setUser(userData);
      setIsLoading(false);
      
      // In a real app, this would verify the payment with Stripe
      // and update the user's credits in the database
    }
    
    loadUser();
  }, [router]);
  
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden p-6">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">Loading...</h1>
        </div>
      </main>
    );
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Payment Successful!
            </h1>
            <p className="text-gray-600">
              Your credits have been added to your account.
            </p>
          </div>
          
          <div className="bg-indigo-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-indigo-800">
              You now have <span className="font-bold">{user?.credits || 0}</span> credits in your account.
            </p>
          </div>
          
          <div className="space-y-4">
            <Link 
              href="/host/create"
              className="block w-full bg-indigo-600 text-white py-3 rounded-md text-center font-medium hover:bg-indigo-700 transition-colors"
            >
              Create a Quiz
            </Link>
            
            <Link 
              href="/host"
              className="block w-full bg-white text-indigo-600 border border-indigo-600 py-3 rounded-md text-center font-medium hover:bg-indigo-50 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}