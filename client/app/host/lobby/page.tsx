"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { User, EVENTS } from 'shared';
import { getCurrentUser } from '@/lib/supabase/auth';

// Helper to generate a random 4-character code (similar to server-side)
function generateLocalRoomCode() {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding characters that look similar
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

export default function Lobby() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<{ id: string, name: string, avatar: string }[]>([]);
  const [roomCode, setRoomCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [gameCreated, setGameCreated] = useState(false);
  const gameCodeRef = useRef<string>('');
  
  const quizId = searchParams.get('quizId');

  // Initialize room code if not already set
  useEffect(() => {
    // On first render, generate a room code that will persist even during app switching
    if (!gameCodeRef.current) {
      gameCodeRef.current = generateLocalRoomCode();
    }
  }, []);

  // Load user and setup game on component mount
  useEffect(() => {
    async function init() {
      try {
        // Check authentication
        const userData = await getCurrentUser();
        if (!userData) {
          router.push('/auth/login');
          return;
        }

        setUser(userData);

        // Connect to Socket.io server with options that work well on mobile
        const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          timeout: 60000,
          autoConnect: true,
          forceNew: false,
          transports: ['websocket', 'polling']
        });
        
        setSocket(socketInstance);

        // Setup event listeners
        socketInstance.on(EVENTS.CONNECT, () => {
          console.log('Connected to game server');
          
          // Only create a game if we haven't already done so
          if (!gameCreated) {
            // Use the persistent room code
            const codeToUse = gameCodeRef.current;
            console.log(`Creating game with host-generated code: ${codeToUse}`);
            
            // Pass the predefined game code to the server
            socketInstance.emit('create_game_with_code', {
              gameCode: codeToUse,
              hostName: userData.name,
              hostAvatar: userData.avatar_url || '👨‍💻',
              hostUserId: userData.id,
              quizId: quizId || undefined
            });
          }
        });

        // Handle game created event
        socketInstance.on(EVENTS.GAME_CREATED, (data: { roomCode: string }) => {
          console.log(`Game created with code: ${data.roomCode}`);
          setRoomCode(data.roomCode);
          setGameCreated(true);
          setIsLoading(false);
        });

        // Handle player joined event
        socketInstance.on(EVENTS.PLAYER_JOINED, (data: { player: { id: string, name: string, avatar: string } }) => {
          console.log(`Player joined: ${data.player.name}`);
          setPlayers(prevPlayers => {
            // Avoid duplicate players
            if (prevPlayers.some(p => p.id === data.player.id)) {
              return prevPlayers;
            }
            return [...prevPlayers, data.player];
          });
        });

        // Handle player left event
        socketInstance.on(EVENTS.PLAYER_LEFT, (data: { playerId: string }) => {
          setPlayers(prevPlayers => prevPlayers.filter(player => player.id !== data.playerId));
        });

        // Handle errors
        socketInstance.on(EVENTS.ERROR, (data: { message: string }) => {
          console.error(`Socket error: ${data.message}`);
          setError(data.message);
          
          // If error indicates someone else is using this code, generate a new one
          if (data.message.includes('already exists')) {
            gameCodeRef.current = generateLocalRoomCode();
            setGameCreated(false);
          }
        });

        // Critical for mobile - handle page visibility changes
        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            console.log('Tab became visible, checking connection');
            
            if (!socketInstance.connected) {
              console.log('Socket disconnected, reconnecting with existing game code');
              socketInstance.connect();
              
              // Wait for connection, then attempt to rejoin
              setTimeout(() => {
                if (gameCreated && roomCode) {
                  socketInstance.emit('join_host_room', {
                    gameCode: roomCode,
                    hostUserId: userData.id
                  });
                }
              }, 500);
            }
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Mobile-specific: Handle focus events
        window.addEventListener('focus', () => {
          console.log('Window focused');
          if (socketInstance && !socketInstance.connected && gameCreated) {
            socketInstance.connect();
          }
        });

        // Cleanup on unmount
        return () => {
          console.log('Cleaning up lobby component');
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          window.removeEventListener('focus', () => {});
          socketInstance.disconnect();
        };
      } catch (error) {
        console.error('Error in lobby initialization:', error);
        setError('Failed to initialize game lobby');
        setIsLoading(false);
      }
    }

    init();
  }, [router, quizId]);

  const handleStartGame = () => {
    if (!socket || !roomCode) return;

    socket.emit(EVENTS.START_GAME, { gameCode: roomCode });

    // Navigate to the game host view
    router.push(`/host/game?code=${roomCode}`);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    // alert('Room code copied to clipboard!');
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Creating Game...</h1>
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-500 mb-6">{error}</p>
          <Link
            href="/host"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md"
          >
            Back to Host
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">
            Game Lobby
          </h1>

          <div className="bg-indigo-50 p-4 rounded-lg mb-6 text-center">
            <p className="text-sm text-indigo-800 mb-2">Share this code with players:</p>
            <div className="flex items-center justify-center">
              <div className="text-3xl font-bold tracking-wider bg-white py-2 px-6 rounded-lg border-2 border-indigo-200">
                {roomCode}
              </div>
              <button
                onClick={copyRoomCode}
                className="ml-2 p-2 text-indigo-600 hover:bg-indigo-100 rounded"
                title="Copy room code"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-indigo-600 mt-2">
              Players can join at {window.location.origin}
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Players ({players.length} + Host)</h2>
            {players.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Waiting for players to join or start playing alone...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {players.map(player => (
                  <div key={player.id} className="flex items-center bg-gray-50 p-3 rounded-lg">
                    <div className="text-2xl mr-2">{player.avatar}</div>
                    <div className="text-gray-700 font-medium truncate">{player.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <button
              onClick={handleStartGame}
              className="w-full bg-indigo-600 text-white py-3 rounded-md font-medium hover:bg-indigo-700 transition-colors"
            >
              Start Game
            </button>

            <Link
              href="/host"
              className="block w-full bg-white text-indigo-600 border border-indigo-600 py-3 rounded-md text-center font-medium hover:bg-indigo-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}