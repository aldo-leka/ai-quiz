"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { User, EVENTS, QuizQuestion, Player } from 'shared';
import { getCurrentUser } from '@/lib/supabase/auth';

export default function HostGame() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameStatus, setGameStatus] = useState<'lobby' | 'question' | 'answer_reveal' | 'leaderboard' | 'finished'>('lobby');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timer, setTimer] = useState<number>(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [playerAnswers, setPlayerAnswers] = useState<{[playerId: string]: string}>({});
  
  const gameCode = searchParams.get('code') || '';
  
  // Load user and connect to game on component mount
  useEffect(() => {
    async function init() {
      if (!gameCode) {
        router.push('/host');
        return;
      }
      
      // Check authentication
      const userData = await getCurrentUser();
      if (!userData) {
        router.push('/auth/login');
        return;
      }
      
      setUser(userData);
      
      // Connect to Socket.io server
      const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      setSocket(socketInstance);
      
      // Setup event listeners
      socketInstance.on(EVENTS.CONNECT, () => {
        console.log('Connected to game server');
        
        // Join the game as host
        socketInstance.emit('join_host_room', { gameCode });
        setIsLoading(false);
      });
      
      // Mock data initialization - in a real app, this data would come from the server
      setTotalQuestions(5);
      
      // Handle game state updates
      socketInstance.on(EVENTS.GAME_STATE_UPDATED, (data: { status: typeof gameStatus, players: Player[] }) => {
        setGameStatus(data.status);
        setPlayers(data.players);
        
        if (data.status === 'question') {
          // Mock current question - in a real app, this would come from the server
          const mockQuestion: QuizQuestion = {
            id: `q${currentQuestionIndex + 1}`,
            text: 'What is the capital of France?',
            type: 'multiple_choice',
            options: ['London', 'Berlin', 'Paris', 'Madrid'],
            correctAnswer: 'Paris',
            explanation: 'Paris is the capital and most populous city of France.'
          };
          
          setCurrentQuestion(mockQuestion);
          startTimer(30); // Start 30 second timer
          setPlayerAnswers({});
        }
      });
      
      // Handle player answers
      socketInstance.on(EVENTS.PLAYER_ANSWERED, (data: { playerId: string, answer: string }) => {
        setPlayerAnswers(prev => ({
          ...prev,
          [data.playerId]: data.answer
        }));
      });
      
      // Cleanup on unmount
      return () => {
        if (timerInterval) clearInterval(timerInterval);
        socketInstance.disconnect();
      };
    }
    
    init();
  }, [gameCode, router, currentQuestionIndex]);
  
  // Timer functions
  const startTimer = (seconds: number) => {
    if (timerInterval) clearInterval(timerInterval);
    
    setTimer(seconds);
    
    const interval = setInterval(() => {
      setTimer(prevTimer => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          handleTimerEnd();
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);
    
    setTimerInterval(interval);
  };
  
  const handleTimerEnd = () => {
    if (!socket) return;
    
    // Time's up - reveal answer
    socket.emit(EVENTS.REVEAL_ANSWER, { gameCode });
  };
  
  // Game control functions
  const handleNextQuestion = () => {
    if (!socket) return;
    
    if (currentQuestionIndex >= totalQuestions - 1) {
      // End the game if all questions are completed
      socket.emit(EVENTS.END_GAME, { gameCode });
    } else {
      // Move to the next question
      setCurrentQuestionIndex(prev => prev + 1);
      socket.emit(EVENTS.NEXT_QUESTION, { gameCode });
    }
  };
  
  const handleRevealAnswer = () => {
    if (!socket || !currentQuestion) return;
    
    if (timerInterval) clearInterval(timerInterval);
    
    socket.emit(EVENTS.REVEAL_ANSWER, { 
      gameCode,
      correctAnswer: currentQuestion.correctAnswer,
      explanation: currentQuestion.explanation
    });
  };
  
  const handleShowLeaderboard = () => {
    if (!socket) return;
    
    socket.emit(EVENTS.SHOW_LEADERBOARD, { gameCode });
  };
  
  const handleEndGame = () => {
    if (!socket) return;
    
    socket.emit(EVENTS.END_GAME, { gameCode });
    
    // Navigate back to host page
    router.push('/host');
  };
  
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
        <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl overflow-hidden p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Loading Game...</h1>
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </main>
    );
  }
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-500 to-purple-700 p-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="bg-white rounded-lg px-4 py-2 shadow">
            <h1 className="text-xl font-bold text-indigo-800">Room: {gameCode}</h1>
          </div>
          
          <div className="bg-white rounded-lg px-4 py-2 shadow">
            <span className="font-medium">Players: {players.length}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left panel - Players */}
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white">
              <h2 className="text-lg font-semibold">Players</h2>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {players.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No players have joined yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {players.map(player => (
                    <div 
                      key={player.id} 
                      className={`flex items-center justify-between p-3 rounded-lg ${player.isConnected ? 'bg-gray-50' : 'bg-gray-100 opacity-60'}`}
                    >
                      <div className="flex items-center">
                        <div className="text-2xl mr-2">{player.avatar}</div>
                        <div className="font-medium">{player.name}</div>
                      </div>
                      <div className="font-bold">{player.score}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Main panel - Game content */}
          <div className="md:col-span-2 bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {gameStatus === 'lobby' && 'Waiting for Players'}
                {gameStatus === 'question' && `Question ${currentQuestionIndex + 1} of ${totalQuestions}`}
                {gameStatus === 'answer_reveal' && 'Answer Revealed'}
                {gameStatus === 'leaderboard' && 'Leaderboard'}
                {gameStatus === 'finished' && 'Game Complete'}
              </h2>
              
              {gameStatus === 'question' && timer > 0 && (
                <div className="bg-white text-indigo-800 px-3 py-1 rounded-full font-bold">
                  {timer}s
                </div>
              )}
            </div>
            
            <div className="p-6">
              {/* Lobby state */}
              {gameStatus === 'lobby' && (
                <div className="text-center py-10">
                  <h3 className="text-2xl font-bold mb-4">Welcome to AI Quiz!</h3>
                  <p className="text-gray-600 mb-8">Waiting for players to join using code: <span className="font-bold text-xl">{gameCode}</span></p>
                  
                  <button
                    onClick={() => socket?.emit(EVENTS.START_GAME, { gameCode })}
                    disabled={players.length === 0}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors"
                  >
                    Start Game
                  </button>
                </div>
              )}
              
              {/* Question state */}
              {gameStatus === 'question' && currentQuestion && (
                <div>
                  <h3 className="text-xl font-bold mb-6">{currentQuestion.text}</h3>
                  
                  {currentQuestion.type === 'multiple_choice' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                      {currentQuestion.options?.map((option, index) => {
                        // Count how many players selected this option
                        const optionCount = Object.values(playerAnswers).filter(answer => answer === option).length;
                        
                        return (
                          <div key={index} className="p-4 border-2 rounded-lg relative">
                            <div className="font-medium">{option}</div>
                            
                            {/* Player count badge */}
                            {optionCount > 0 && (
                              <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                {optionCount}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <div>
                      <span className="text-gray-500">
                        {Object.keys(playerAnswers).length} of {players.length} answered
                      </span>
                    </div>
                    
                    <button
                      onClick={handleRevealAnswer}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Reveal Answer
                    </button>
                  </div>
                </div>
              )}
              
              {/* Answer reveal state */}
              {gameStatus === 'answer_reveal' && currentQuestion && (
                <div>
                  <h3 className="text-xl font-bold mb-4">{currentQuestion.text}</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {currentQuestion.options?.map((option, index) => {
                      const isCorrect = option === currentQuestion.correctAnswer;
                      // Count how many players selected this option
                      const optionCount = Object.values(playerAnswers).filter(answer => answer === option).length;
                      
                      return (
                        <div 
                          key={index} 
                          className={`p-4 border-2 rounded-lg relative ${isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                        >
                          <div className="font-medium">{option}</div>
                          
                          {isCorrect && (
                            <div className="absolute top-2 right-2 text-green-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          
                          {/* Player count badge */}
                          {optionCount > 0 && (
                            <div className="absolute bottom-2 right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                              {optionCount}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {currentQuestion.explanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <h4 className="font-semibold text-blue-800 mb-1">Explanation</h4>
                      <p className="text-blue-800">{currentQuestion.explanation}</p>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <button
                      onClick={currentQuestionIndex >= totalQuestions - 1 ? handleShowLeaderboard : handleNextQuestion}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      {currentQuestionIndex >= totalQuestions - 1 ? 'Show Final Results' : 'Next Question'}
                    </button>
                  </div>
                </div>
              )}
              
              {/* Leaderboard state */}
              {gameStatus === 'leaderboard' && (
                <div>
                  <h3 className="text-2xl font-bold mb-6 text-center">
                    {currentQuestionIndex >= totalQuestions - 1 ? 'Final Results' : 'Leaderboard'}
                  </h3>
                  
                  <div className="space-y-2 mb-8">
                    {players
                      .sort((a, b) => b.score - a.score)
                      .map((player, index) => (
                        <div 
                          key={player.id} 
                          className={`flex items-center justify-between p-4 rounded-lg ${index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : index === 2 ? 'bg-orange-100' : 'bg-white border'}`}
                        >
                          <div className="flex items-center">
                            <div className="w-8 text-center font-bold mr-3">{index + 1}</div>
                            <div className="text-2xl mr-2">{player.avatar}</div>
                            <div className="font-medium">{player.name}</div>
                          </div>
                          <div className="font-bold text-xl">{player.score}</div>
                        </div>
                      ))
                    }
                  </div>
                  
                  <div className="flex justify-end">
                    {currentQuestionIndex >= totalQuestions - 1 ? (
                      <button
                        onClick={handleEndGame}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        End Game
                      </button>
                    ) : (
                      <button
                        onClick={handleNextQuestion}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                      >
                        Next Question
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Game finished state */}
              {gameStatus === 'finished' && (
                <div className="text-center py-10">
                  <h3 className="text-2xl font-bold mb-4">Game Completed!</h3>
                  <p className="text-gray-600 mb-8">Thanks for playing!</p>
                  
                  <Link 
                    href="/host"
                    className="px-6 py-3 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Back to Home
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}