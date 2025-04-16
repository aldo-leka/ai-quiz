"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AVATAR_OPTIONS } from 'shared';

export function JoinGameForm() {
  const router = useRouter();
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [error, setError] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gameCode.trim()) {
      setError('Please enter a game code');
      return;
    }
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    // Redirect to the game page with the provided information
    router.push(
      `/join?code=${gameCode.toUpperCase()}&name=${encodeURIComponent(playerName)}&avatar=${encodeURIComponent(selectedAvatar)}`
    );
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="gameCode" className="block text-sm font-medium text-gray-700 mb-1">
          Game Code
        </label>
        <input
          type="text"
          id="gameCode"
          value={gameCode}
          onChange={(e) => setGameCode(e.target.value.toUpperCase())}
          maxLength={4}
          placeholder="Enter 4-letter code"
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      
      <div>
        <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-1">
          Your Name
        </label>
        <input
          type="text"
          id="playerName"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={20}
          placeholder="Enter your name"
          className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Choose Avatar
        </label>
        <div className="grid grid-cols-6 gap-2">
          {AVATAR_OPTIONS.slice(0, 12).map((avatar) => (
            <button
              key={avatar}
              type="button"
              onClick={() => setSelectedAvatar(avatar)}
              className={`w-10 h-10 flex items-center justify-center text-2xl rounded-full ${selectedAvatar === avatar ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'hover:bg-gray-100'}`}
            >
              {avatar}
            </button>
          ))}
        </div>
      </div>
      
      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}
      
      <button
        type="submit"
        className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-md font-medium hover:from-purple-700 hover:to-indigo-700 transition-colors"
      >
        Join Game
      </button>
    </form>
  );
}
