"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { EVENTS } from 'shared';

export default function JoinGame() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  
  const gameCode = searchParams.get('code') || '';
  const playerName = searchParams.get('name') || '';
  const playerAvatar = searchParams.get('avatar') || '';
  
  useEffect(() => {
    if (!gameCode || !playerName || !playerAvatar) {
      router.push('/');
      return;
    }
    
    // Connect to the Socket.IO server
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    setSocket(socketInstance);
    
    // Setup event listeners
    socketInstance.on(EVENTS.CONNECT, () => {
      setStatus('connected');
      
      // Join the game
      socketInstance.emit(EVENTS.JOIN_GAME, {
        gameCode,
        playerName,
        playerAvatar
      });
    });
    
    socketInstance.on(EVENTS.PLAYER_JOINED, () => {
      setStatus('joined');
    });
    
    socketInstance.on(EVENTS.GAME_STARTED, () => {
      router.push(`/game?code=${gameCode}`);
    });
    
    socketInstance.on(EVENTS.ERROR, (data) => {
      setError(data.message);
      setStatus('error');
    });
    
    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [gameCode, playerName, playerAvatar, router]);
  
  // Render different UI based on connection status
  let content;
  switch (status) {
    case 'connecting':
      content = <p>Connecting to game...</p>;
      break;
    case 'connected':
      content = <p>Connected! Joining game {gameCode}...</p>;
      break;
    case 'joined':
      content = (
        <div>
          <p className="mb-4">Joined game {gameCode} as {playerName} {playerAvatar}</p>
          <p>Waiting for host to start the game...</p>
        </div>
      );
      break;
    case 'error':
      content = (
        <div>
          <p className="text-red-500">{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md"
          >
            Return Home
          </button>
        </div>
      );
      break;
    default:
      content = <p>Something went wrong...</p>;
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden p-6 text-center">
        <h1 className="text-2xl font-bold mb-4">AI Quiz Game</h1>
        {content}
      </div>
    </main>
  );
}
