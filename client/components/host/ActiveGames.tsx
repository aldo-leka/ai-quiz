import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchActiveGames, ActiveGame } from '@/lib/api';

const formatTimeAgo = (dateString?: string): string => {
  if (!dateString) return 'unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
};

export default function ActiveGames() {
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActiveGames = async () => {
      try {
        setIsLoading(true);
        const games = await fetchActiveGames();
        setActiveGames(games);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch active games:', err);
        setError('Failed to load your active games. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveGames();
    
    // Refresh every minute
    const intervalId = setInterval(loadActiveGames, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  if (isLoading) {
    return (
      <div className="animate-pulse my-6">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-6 p-4 bg-red-50 text-red-600 rounded-md">
        <p>{error}</p>
        <button 
          onClick={() => fetchActiveGames().then(setActiveGames)}
          className="mt-2 text-sm font-medium underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (activeGames.length === 0) {
    return null; // Don't show anything if there are no active games
  }

  return (
    <div className="my-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Your Active Games
      </h2>
      
      <div className="space-y-3">
        {activeGames.map(game => (
          <div 
            key={game.id}
            className="p-4 border border-indigo-100 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center">
                  <span className="font-medium text-lg">Game Code: {game.code}</span>
                  {game.hostDisconnectedAt && (
                    <span className="ml-2 px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800">
                      Host Disconnected
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mt-1">
                  Status: <span className="capitalize">{game.status}</span> • 
                  Question {game.currentQuestionIndex + 1} • 
                  {game.activePlayerCount} of {game.playerCount} players active
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Last activity: {formatTimeAgo(game.lastActivityAt)}
                </p>
              </div>
              
              <Link
                href={`/host/game?code=${game.code}&resume=true`}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Resume Hosting
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}