import Link from 'next/link';
import { JoinGameForm } from '@/components/game/JoinGameForm';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            QuizPlus.io
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Join a multiplayer quiz or create your own AI-generated game!
          </p>
          
          <JoinGameForm />
          
          <div className="mt-6 flex flex-col space-y-4">
            <Link 
              href="/host"
              className="w-full bg-indigo-600 text-white py-3 rounded-md text-center font-medium hover:bg-indigo-700 transition-colors"
            >
              Create Game
            </Link>
            
            <Link 
              href="/about"
              className="w-full text-indigo-600 py-2 rounded-md text-center font-medium hover:text-indigo-700 transition-colors"
            >
              About
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
