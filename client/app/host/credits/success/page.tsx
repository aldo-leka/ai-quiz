"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { User } from 'shared';
import { getCurrentUser } from '@/lib/supabase/auth';

export default function PaymentSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  
  // Extract the session ID from the URL query parameters
  const sessionId = searchParams.get('session_id');
  
  // Load user and check payment status on component mount
  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      try {
        const userData = await getCurrentUser();
        if (!userData && isMounted) {
          // Redirect to login if not authenticated
          router.push('/auth/login');
          return;
        }
        
        if (isMounted) {
          setUser(userData);
        }
        
        // Check payment status if sessionId is provided
        if (sessionId && isMounted) {
          const { checkSessionStatus } = await import('@/lib/api');
          const sessionData = await checkSessionStatus(sessionId);
          
          if (isMounted) {
            setIsPending(sessionData.isPending);
            setPaymentAmount(parseInt(sessionData.amount) || 0);
          }
          
          // If payment is still pending, poll every 2 seconds
          if (sessionData.isPending && isMounted) {
            const interval = setInterval(async () => {
              const updatedSession = await checkSessionStatus(sessionId);
              
              if (isMounted) {
                setIsPending(updatedSession.isPending);
                
                if (!updatedSession.isPending) {
                  clearInterval(interval);
                  // Refresh user data to get updated credits
                  const refreshedUser = await getCurrentUser();
                  if (isMounted) {
                    setUser(refreshedUser);
                  }
                }
              } else {
                clearInterval(interval);
              }
            }, 2000);
            
            return () => clearInterval(interval);
          } else if (isMounted) {
            // If payment is completed, refresh user data to get updated credits
            const refreshedUser = await getCurrentUser();
            if (isMounted) {
              setUser(refreshedUser);
            }
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [router, sessionId]);
  
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden p-6">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">Loading...</h1>
        </div>
      </main>
    );
  }
  
  if (isPending) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Processing Payment
              </h1>
              <p className="text-gray-600">
                Please wait while we process your payment...
              </p>
            </div>
          </div>
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
              {paymentAmount ? `${paymentAmount} credits have been added to your account.` : 'Your credits have been added to your account.'}
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