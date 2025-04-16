"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User } from 'shared';
import { getCurrentUser } from '@/lib/supabase/auth';
import { CREDIT_PACKAGES } from 'shared';

export default function Credits() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<keyof typeof CREDIT_PACKAGES | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
    }
    
    loadUser();
  }, [router]);
  
  const handlePurchase = async () => {
    if (!selectedPackage || !user) return;
    
    setIsProcessing(true);
    
    try {
      // In a real implementation, this would call an API to create a Stripe checkout session
      console.log(`Purchasing ${selectedPackage} package`);
      
      // Simulate API call
      setTimeout(() => {
        // This would redirect to Stripe checkout
        router.push('/host/credits/success');
      }, 1500);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setIsProcessing(false);
    }
  };
  
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
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            Purchase Credits
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Credits are used to create AI-generated quizzes
          </p>
          
          <div className="bg-indigo-50 p-4 rounded-lg mb-6">
            <p className="text-sm text-indigo-800">
              You currently have <span className="font-bold">{user?.credits || 0}</span> credits
            </p>
          </div>
          
          <div className="space-y-4 mb-6">
            {Object.entries(CREDIT_PACKAGES).map(([key, pack]) => (
              <button
                key={key}
                onClick={() => setSelectedPackage(key as keyof typeof CREDIT_PACKAGES)}
                className={`w-full p-4 border-2 rounded-lg text-left flex justify-between items-center ${selectedPackage === key ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
              >
                <div>
                  <div className="font-medium">{pack.amount} Credits</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {pack.discount > 0 ? `Save ${pack.discount}%` : 'Standard price'}
                  </div>
                </div>
                <div className="text-lg font-bold">
                  ${pack.price.toFixed(2)}
                </div>
              </button>
            ))}
          </div>
          
          <button
            onClick={handlePurchase}
            disabled={!selectedPackage || isProcessing}
            className="w-full bg-indigo-600 text-white py-3 rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 mb-4"
          >
            {isProcessing ? 'Processing...' : 'Purchase Credits'}
          </button>
          
          <div className="text-xs text-center text-gray-500 mb-6">
            Payments are processed securely via Stripe. By purchasing, you agree to our <Link href="/terms" className="text-indigo-600">Terms of Service</Link>.
          </div>
          
          <div className="mt-4">
            <Link 
              href="/host"
              className="block text-center text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              ← Back to Host
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
