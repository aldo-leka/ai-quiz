"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { EVENTS, GameSession, Player, QuizQuestion } from 'shared';

export default function GamePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [playerAnswer, setPlayerAnswer] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [timer, setTimer] = useState<number>(0);
  
  const gameCode = searchParams.get('code') || '';
  
  useEffect(() => {
    if (!gameCode) {
      router.push('/');
      return;
    }
    
    // Connect to the Socket.IO server
    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    setSocket(socketInstance);
    
    // Setup event listeners
    socketInstance.on(EVENTS.CONNECT, () => {
      console.log('Connected to game server');
    });
    
    socketInstance.on(EVENTS.GAME_STATE_UPDATED, (data: GameSession) => {
      setGameState(data);
      
      if (data.status === 'question' && data.currentQuestionIndex !== undefined) {
        // For now, we'll simulate a question (this would come from the server in the real app)
        setCurrentQuestion({
          id: 'q1',
          text: 'What is the capital of France?',
          type: 'multiple_choice',
          options: ['London', 'Berlin', 'Paris', 'Madrid'],
          correctAnswer: 'Paris',
          explanation: 'Paris is the capital of France.'
        });
        
        // Start the timer
        setTimer(30);
      }
    });
    
    socketInstance.on(EVENTS.PLAYER_JOINED, (data: { player: Player }) => {
      setPlayers(prevPlayers => [...prevPlayers, data.player]);
    });
    
    socketInstance.on(EVENTS.PLAYER_LEFT, (data: { playerId: string }) => {
      setPlayers(prevPlayers => prevPlayers.filter(player => player.id !== data.playerId));
    });
    
    socketInstance.on(EVENTS.ANSWER_REVEALED, (data: { correctAnswer: string, explanation: string }) => {
      // Show the correct answer
      // This would be implemented in a real app
    });
    
    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [gameCode, router]);
  
  // Timer effect
  useEffect(() => {
    if (timer <= 0) return;
    
    const interval = setInterval(() => {
      setTimer(prevTimer => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          // Time's up - submit whatever answer the player has selected
          handleSubmitAnswer();
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timer]);
  
  const handleSelectAnswer = (answer: string) => {
    setPlayerAnswer(answer);
  };
  
  const handleSubmitAnswer = () => {
    if (!socket || !playerAnswer || !currentQuestion) return;
    
    socket.emit(EVENTS.SUBMIT_ANSWER, {
      gameCode,
      questionId: currentQuestion.id,
      answer: playerAnswer
    });
    
    // Reset for next question
    setPlayerAnswer('');
  };
  
  if (!gameState) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">AI Quiz Game</h1>
          <p>Loading game...</p>
        </div>
      </main>
    );
  }
  
  // Render based on game state
  let content;
  switch (gameState.status) {
    case 'lobby':
      content = (
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Waiting for game to start</h2>
          <p className="mb-4">Game Code: <span className="font-bold">{gameCode}</span></p>
          <p className="mb-2">Players joined:</p>
          <ul className="space-y-1">
            {players.map(player => (
              <li key={player.id} className="flex items-center justify-center">
                <span className="mr-2">{player.avatar}</span>
                <span>{player.name}</span>
              </li>
            ))}
          </ul>
        </div>
      );
      break;
      
    case 'question':
      content = currentQuestion && (
        <div className="text-center">
          <div className="mb-4 text-right">
            <span className="inline-block bg-indigo-600 text-white px-3 py-1 rounded-full">
              Time: {timer}s
            </span>
          </div>
          
          <h2 className="text-xl font-semibold mb-6">{currentQuestion.text}</h2>
          
          <div className="grid grid-cols-1 gap-3 mb-6">
            {currentQuestion.options?.map((option, index) => (
              <button
                key={index}
                onClick={() => handleSelectAnswer(option)}
                className={`p-4 rounded-lg border-2 text-left ${playerAnswer === option ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                {option}
              </button>
            ))}
          </div>
          
          <button
            onClick={handleSubmitAnswer}
            disabled={!playerAnswer}
            className="w-full py-3 bg-indigo-600 text-white rounded-md font-medium disabled:bg-indigo-300 transition-colors"
          >
            Submit Answer
          </button>
        </div>
      );
      break;
      
    case 'answer_reveal':
      content = (
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Answer Revealed</h2>
          {/* Show correct answer and explanation */}
        </div>
      );
      break;
      
    case 'leaderboard':
      content = (
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
          <div className="space-y-2">
            {players
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : index === 2 ? 'bg-orange-100' : 'bg-white'}`}
                >
                  <div className="flex items-center">
                    <span className="font-bold mr-2">{index + 1}.</span>
                    <span className="mr-2">{player.avatar}</span>
                    <span>{player.name}</span>
                  </div>
                  <span className="font-bold">{player.score}</span>
                </div>
              ))
            }
          </div>
        </div>
      );
      break;
      
    case 'finished':
      content = (
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Game Finished!</h2>
          <p className="mb-4">Thanks for playing!</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md"
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
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">AI Quiz Game</h1>
        {content}
      </div>
    </main>
  );
}
