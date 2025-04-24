"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { EVENTS, GameSession, Player, QuizQuestion } from 'shared';
import { handlePlayerReconnection } from '@/lib/utils/reconnection';

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
      console.log('Connected to game server');
      
      // Get player info from search params
      const playerName = searchParams.get('name') || '';
      const playerAvatar = searchParams.get('avatar') || '';
      
      if (playerName && playerAvatar) {
        console.log(`Player connected - sending reconnect_player event for ${playerName} to room ${gameCode}`);
        
        // Always try to reconnect the player when we establish a connection
        socketInstance.emit('reconnect_player', {
          gameCode,
          playerName,
          playerAvatar
        });
      }
    });
    
    // Handle socket reconnection events
    socketInstance.on('reconnect', () => {
      console.log('Socket reconnected - attempting to rejoin game');
      
      // Get player info from search params
      const playerName = searchParams.get('name') || '';
      const playerAvatar = searchParams.get('avatar') || '';
      
      if (playerName && playerAvatar) {
        console.log(`Player reconnected - sending reconnect_player event for ${playerName}`);
        socketInstance.emit('reconnect_player', {
          gameCode,
          playerName,
          playerAvatar
        });
      }
    });
    
    // Handle visibility change (browser tab hidden/visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socketInstance) {
        console.log('Tab became visible, checking connection');
        if (!socketInstance.connected) {
          socketInstance.connect();
          
          // After reconnecting, try to rejoin the game
          setTimeout(() => {
            const playerName = searchParams.get('name') || '';
            const playerAvatar = searchParams.get('avatar') || '';
            
            if (playerName && playerAvatar) {
              console.log(`Visibility changed - reconnecting player ${playerName}`);
              socketInstance.emit('reconnect_player', {
                gameCode,
                playerName,
                playerAvatar
              });
            }
          }, 500);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    socketInstance.on(EVENTS.GAME_STATE_UPDATED, async (data: GameSession) => {
      console.log("Game state updated:", data.status, data);
      setGameState(data);
      
      // Update players list if players data is available
      if (data.players && Array.isArray(data.players)) {
        console.log(`Received ${data.players.length} players from server`);
        setPlayers(data.players);
      }
      
      if (data.status === 'question' && data.currentQuestionIndex !== undefined && data.currentQuizId) {
        try {
          // Always fetch the quiz data since GameSession doesn't store currentQuestion
          const { fetchQuizById } = await import('@/lib/api');
          const quiz = await fetchQuizById(data.currentQuizId, gameCode);
          
          if (quiz && quiz.questions && quiz.questions.length > data.currentQuestionIndex) {
            // Reset answer when moving to a new question
            if (currentQuestion?.id !== quiz.questions[data.currentQuestionIndex].id) {
              console.log("New question detected, resetting player answer");
              setPlayerAnswer('');
            }
            
            setCurrentQuestion(quiz.questions[data.currentQuestionIndex]);
          } else {
            console.error('Quiz data not found or invalid question index');
          }
          
          // Reset the timer to default value until server sends updates
          setTimer(30);
        } catch (error) {
          console.error('Error fetching quiz question:', error);
        }
      }
    });
    
    socketInstance.on(EVENTS.PLAYER_JOINED, (data: { player: Player }) => {
      setPlayers(prevPlayers => [...prevPlayers, data.player]);
    });
    
    socketInstance.on(EVENTS.PLAYER_LEFT, (data: { playerId: string }) => {
      setPlayers(prevPlayers => prevPlayers.filter(player => player.id !== data.playerId));
    });
    
    // Handle host disconnection event
    socketInstance.on(EVENTS.HOST_DISCONNECTED, (data: { message: string }) => {
      // Show a notification to the player that the host is temporarily disconnected
      // alert(data.message);
    });
    
    // Handle host reconnection event
    socketInstance.on(EVENTS.HOST_RECONNECTED, (data: { message: string }) => {
      // Notify player that the host has returned
      // alert(data.message);
    });
    
    // Handle next game selection
    socketInstance.on('next_game_selected', (data: { nextGameType: string }) => {
      console.log(`New game selected: ${data.nextGameType}`);
      
      // Reset player state for new game
      setPlayerAnswer('');
      setCurrentQuestion(null);
    });
    
    // Handle leaderboard updates
    socketInstance.on(EVENTS.LEADERBOARD_UPDATED, () => {
      console.log("Leaderboard updated event received - players state:", players);
      
      // Ensure we have the latest player data
      if (gameState && gameState.players) {
        setPlayers(gameState.players);
      }
    });
    
    socketInstance.on(EVENTS.ANSWER_REVEALED, (data: { questionId: string, correctAnswer: string | string[], explanation?: string, playerAnswers: any[] }) => {
      // DON'T reset playerAnswer here - we need it to display the correct/incorrect state
      // Update the UI to show correct answer and player results
      console.log("Answer revealed event received:", data);
      
      // Show a toast or message with the correct answer
      if (typeof data.correctAnswer === 'string') {
        console.log(`Correct answer: ${data.correctAnswer}`);
      } else if (Array.isArray(data.correctAnswer)) {
        console.log(`Correct answers: ${data.correctAnswer.join(', ')}`);
      }
      
      if (data.explanation) {
        console.log(`Explanation: ${data.explanation}`);
      }
      
      // Find current player's result
      const playerName = searchParams.get('name');
      const currentPlayerResult = data.playerAnswers.find(pa => 
        pa.playerName === playerName || pa.player?.name === playerName
      );
      
      if (currentPlayerResult) {
        console.log(`Your answer was ${currentPlayerResult.isCorrect ? 'correct!' : 'incorrect.'}`);
      }
    });
    
    // Handle timer updates from server
    socketInstance.on('timer_update', (data: { remaining?: number, questionId: string, totalSeconds?: number, isTimed?: boolean }) => {
      console.log(`Server timer update for question ${data.questionId}:`, data);
      
      // Check if this is an untimed quiz
      if (data.isTimed === false) {
        console.log('This is an untimed quiz - hiding timer');
        setTimer(-1); // Use -1 to indicate no timer
        return;
      }
      
      // Only update timer if it's for the current question and it's a timed quiz
      if (currentQuestion?.id === data.questionId && data.remaining !== undefined) {
        setTimer(data.remaining);
      }
    });
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socketInstance.disconnect();
    };
  }, [gameCode, playerName, playerAvatar, router]);
  
  // Effect to handle timer reaching zero
  useEffect(() => {
    // Only trigger for timed quizzes (timer === 0)
    // Skip for untimed quizzes (timer === -1)
    if (timer === 0 && gameState?.status === 'question' && currentQuestion) {
      console.log('Timer reached zero, auto-submitting answer');
      handleSubmitAnswer(true);
    }
  }, [timer, gameState?.status, currentQuestion]);
  
  const handleSelectAnswer = (answer: string) => {
    setPlayerAnswer(answer);
  };
  
  const handleSubmitAnswer = (timeExpired = false) => {
    if (!socket || !currentQuestion) return;
    
    // If time expired but no answer was selected, submit a blank answer
    // This ensures the game proceeds even without an answer
    if (timeExpired && !playerAnswer) {
      console.log("Timer expired with no answer - submitting empty answer to continue game");
      
      socket.emit(EVENTS.SUBMIT_ANSWER, {
        gameCode,
        questionId: currentQuestion.id,
        answer: "",
        timeToAnswer: 30000 // Maximum time (30 seconds in ms)
      });
      
      return;
    }
    
    // For regular submission, require an answer
    if (!playerAnswer && !timeExpired) return;
    
    // Calculate time to answer (30 seconds minus remaining time)
    const timeToAnswer = (30 - timer) * 1000; // Convert to milliseconds
    
    // Store the answer locally before submitting it
    const answerToSubmit = playerAnswer;
    
    console.log(`Submitting answer: ${answerToSubmit}`);
    
    socket.emit(EVENTS.SUBMIT_ANSWER, {
      gameCode,
      questionId: currentQuestion.id,
      answer: answerToSubmit,
      timeToAnswer
    });
    
    // Don't reset playerAnswer here - we need it for answer_reveal state
    // It will be reset when moving to a new question
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
          {/* Only show timer if this is a timed quiz (timer >= 0) */}
          {timer >= 0 && (
            <div className="mb-4 text-right">
              <span className="inline-block bg-indigo-600 text-white px-3 py-1 rounded-full">
                Time: {timer}s
              </span>
            </div>
          )}
          
          <h2 className="text-xl font-semibold mb-6">{currentQuestion.text}</h2>
          
          {/* Multiple Choice Question */}
          {(!currentQuestion.type || currentQuestion.type === 'multiple_choice') && (
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
          )}
          
          {/* Fill in the Blank Question */}
          {currentQuestion.type === 'fill_in_blank' && (
            <div className="mb-6">
              <input
                type="text"
                value={playerAnswer}
                onChange={(e) => handleSelectAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>
          )}
          
          {/* Flashcard Question */}
          {currentQuestion.type === 'flashcard' && (
            <div className="mb-6 relative">
              <div className="cursor-pointer rounded-lg shadow-lg overflow-hidden" 
                   onClick={() => handleSelectAnswer(playerAnswer ? '' : 'flipped')}>
                <div className={`transition-all duration-500 ${playerAnswer ? 'opacity-0 absolute' : 'opacity-100'}`}>
                  <div className="bg-indigo-100 p-6 min-h-[200px] flex flex-col justify-center">
                    <div className="text-xl font-medium">{currentQuestion.front || currentQuestion.text}</div>
                    <div className="mt-4 text-indigo-600">Click to reveal answer</div>
                  </div>
                </div>
                <div className={`transition-all duration-500 ${playerAnswer ? 'opacity-100' : 'opacity-0 absolute'}`}>
                  <div className="bg-indigo-50 p-6 min-h-[200px] flex flex-col justify-center">
                    <div className="text-xl font-medium">{currentQuestion.back || currentQuestion.correctAnswer}</div>
                    <div className="mt-4 text-indigo-600">Click to flip back</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <button
            onClick={() => handleSubmitAnswer(false)}
            disabled={!playerAnswer && currentQuestion.type !== 'flashcard'}
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
          
          {currentQuestion && (
            <>
              <h3 className="text-lg mb-4">{currentQuestion.text}</h3>
              
              {/* Multiple Choice Answer Reveal */}
              {(!currentQuestion.type || currentQuestion.type === 'multiple_choice') && currentQuestion.options && (
                <div className="grid grid-cols-1 gap-3 mb-6">
                  {currentQuestion.options.map((option, index) => {
                    const isCorrect = option === currentQuestion.correctAnswer;
                    const isSelected = playerAnswer === option;
                    
                    let className = "p-4 rounded-lg border-2 text-left ";
                    
                    if (isCorrect) {
                      className += "border-green-500 bg-green-50 ";
                    } else if (isSelected) {
                      className += "border-red-500 bg-red-50 ";
                    } else {
                      className += "border-gray-200 ";
                    }
                    
                    return (
                      <div key={index} className={className}>
                        <div className="flex justify-between items-center">
                          <div className="font-medium">{option}</div>
                          {isCorrect && (
                            <div className="text-green-500">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Fill in the Blank Answer Reveal */}
              {currentQuestion.type === 'fill_in_blank' && (
                <div className="mb-6">
                  <div className="p-4 rounded-lg border-2 border-gray-200 mb-4">
                    <div className="font-medium">Your answer:</div>
                    <div className={`mt-2 p-2 rounded ${
                        typeof playerAnswer === 'string' && 
                        typeof currentQuestion.correctAnswer === 'string' && 
                        playerAnswer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase() 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                      {playerAnswer || '(No answer)'}
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50">
                    <div className="font-medium">Correct answer:</div>
                    <div className="mt-2 p-2 rounded bg-white">
                      {currentQuestion.correctAnswer}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Flashcard Answer Reveal */}
              {currentQuestion.type === 'flashcard' && (
                <div className="mb-6">
                  <div className="p-6 rounded-lg bg-indigo-50 border-2 border-indigo-200">
                    <div className="font-semibold text-indigo-800 mb-2">Front:</div>
                    <div className="p-4 bg-white rounded mb-4">
                      {currentQuestion.front || currentQuestion.text}
                    </div>
                    
                    <div className="font-semibold text-indigo-800 mb-2">Back:</div>
                    <div className="p-4 bg-white rounded">
                      {currentQuestion.back || currentQuestion.correctAnswer}
                    </div>
                  </div>
                </div>
              )}
              
              {currentQuestion.explanation && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-800 mb-1">Explanation</h4>
                  <p className="text-blue-800">{currentQuestion.explanation}</p>
                </div>
              )}
              
              <div className="mt-6">
                {(!currentQuestion.type || currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'fill_in_blank') && (
                  (() => {
                    console.log("Checking answer correctness:");
                    console.log("- Player answer:", playerAnswer);
                    console.log("- Correct answer:", currentQuestion.correctAnswer);
                    
                    let isCorrect = false;
                    
                    // Handle string answer
                    if (typeof playerAnswer === 'string' && typeof currentQuestion.correctAnswer === 'string') {
                      isCorrect = playerAnswer.toLowerCase().trim() === currentQuestion.correctAnswer.toLowerCase().trim();
                      console.log(`- String comparison: ${playerAnswer.toLowerCase().trim()} === ${currentQuestion.correctAnswer.toLowerCase().trim()} => ${isCorrect}`);
                    }
                    // Handle array answer
                    else if (Array.isArray(currentQuestion.correctAnswer)) {
                      if (typeof playerAnswer === 'string') {
                        // Check if player answer matches any of the correct answers
                        isCorrect = currentQuestion.correctAnswer.some(
                          answer => playerAnswer.toLowerCase().trim() === answer.toLowerCase().trim()
                        );
                        console.log(`- Array comparison (single answer): ${isCorrect}`);
                      } else if (Array.isArray(playerAnswer)) {
                        // Check if arrays match (ignoring order)
                        // const normalizedPlayerAnswers = playerAnswer.map(a => a.toLowerCase().trim()).sort();
                        // const normalizedCorrectAnswers = currentQuestion.correctAnswer.map(a => a.toLowerCase().trim()).sort();
                        // isCorrect = normalizedPlayerAnswers.length === normalizedCorrectAnswers.length &&
                        //   normalizedPlayerAnswers.every((a, i) => a === normalizedCorrectAnswers[i]);
                        // console.log(`- Array comparison (multiple answers): ${isCorrect}`);
                      }
                    }
                    
                    return isCorrect ? (
                      <div className="text-green-600 font-bold text-xl">
                        ✓ Your answer is correct!
                      </div>
                    ) : (
                      <div className="text-red-600 font-bold text-xl">
                        ✗ Your answer is incorrect
                      </div>
                    );
                  })()
                )}
                
                {currentQuestion.type === 'flashcard' && (
                  <div className="text-indigo-600 font-bold">
                    Ready for the next card!
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      );
      break;
      
    case 'leaderboard':
      content = (
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
          <div className="space-y-2">
            {console.log("Rendering leaderboard with players:", players)}
            {players.length > 0 ? (
              players
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
            ) : (
              <div className="p-4 bg-gray-100 rounded-lg text-gray-600">
                No players found. This might be a connection issue.
              </div>
            )}
          </div>
        </div>
      );
      break;
      
    case 'finished':
      content = (
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Game Finished!</h2>
          <p className="mb-6">Thanks for playing! What would you like to do next?</p>
          
          <div className="text-gray-500 text-sm mb-8">
            Waiting for host to decide what to do next...
          </div>
          
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Leave Game
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
