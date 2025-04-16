"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Quiz } from 'shared';
import { getCurrentUser } from '@/lib/supabase/auth';

// Mock data for quizzes
const mockQuizzes: Quiz[] = [
  {
    id: '1',
    title: 'Space Exploration',
    description: 'Test your knowledge about planets, stars, and space missions.',
    theme: 'Space',
    type: 'multiple_choice',
    questions: [],
    createdById: '1',
    createdAt: new Date().toISOString(),
    imageUrl: 'https://placehold.co/100x100?text=Space',
  },
  {
    id: '2',
    title: 'World Geography',
    description: 'How well do you know countries, capitals, and landmarks?',
    theme: 'Geography',
    type: 'multiple_choice',
    questions: [],
    createdById: '1',
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    imageUrl: 'https://placehold.co/100x100?text=Geography',
  },
];

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load user and quizzes on component mount
  useEffect(() => {
    async function loadData() {
      const userData = await getCurrentUser();
      if (!userData) {
        // Redirect to login if not authenticated
        router.push('/auth/login');
        return;
      }
      
      setUser(userData);
      
      // In a real app, this would fetch quizzes from an API
      // For now, we'll use mock data
      setTimeout(() => {
        setQuizzes(mockQuizzes);
        setIsLoading(false);
      }, 1000);
    }
    
    loadData();
  }, [router]);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
        <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl overflow-hidden p-6">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">Loading...</h1>
        </div>
      </main>
    );
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-500 to-purple-700 p-4 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              My Quizzes
            </h1>
            
            <Link 
              href="/host"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Create New Quiz
            </Link>
          </div>
          
          {quizzes.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-600 mb-4">You haven't created any quizzes yet.</p>
              <Link 
                href="/host"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Create Your First Quiz
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-4 flex items-start">
                    {quiz.imageUrl && (
                      <div className="mr-4">
                        <div className="w-20 h-20 rounded bg-gray-200 overflow-hidden">
                          <img src={quiz.imageUrl} alt={quiz.title} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h2 className="text-lg font-semibold text-gray-800">{quiz.title}</h2>
                        <span className="text-sm text-gray-500">{formatDate(quiz.createdAt)}</span>
                      </div>
                      <p className="text-gray-600 text-sm mb-2">{quiz.description}</p>
                      <div className="flex justify-between items-center">
                        <div className="flex space-x-2">
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                            {formatQuizType(quiz.type)}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                            {quiz.theme}
                          </span>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Link 
                            href={`/host/lobby?quizId=${quiz.id}`}
                            className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                          >
                            Host Game
                          </Link>
                          <button 
                            className="px-3 py-1 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 transition-colors"
                            title="View statistics"
                          >
                            Stats
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function formatQuizType(type: string): string {
  switch(type) {
    case 'multiple_choice': return 'Multiple Choice';
    case 'true_false': return 'True/False';
    case 'flashcards': return 'Flashcards';
    case 'timed': return 'Timed Quiz';
    case 'fill_in_blank': return 'Fill in the Blank';
    default: return type;
  }
}
