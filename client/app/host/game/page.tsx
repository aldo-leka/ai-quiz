"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { User, EVENTS, QuizQuestion, Player, GameSession } from 'shared';
import { getCurrentUser } from '@/lib/supabase/auth';
import { handleHostReconnection } from '@/lib/utils/reconnection';
import {
  GameTimer,
  PlayerList,
  QuestionDisplay,
  AnswerReveal,
  Leaderboard,
  GameFinished,
  LobbyScreen
} from '@/components/host';

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
  const [playerAnswers, setPlayerAnswers] = useState<{[playerId: string]: string}>({});
  const [hostAnswer, setHostAnswer] = useState<string>('');
  
  const gameCode = searchParams.get('code') || '';
  const isResuming = searchParams.get('resume') === 'true';

  console.log(`-----socket.id: ${socket?.id}`);
  
  // Load user and connect to game on component mount
  useEffect(() => {
    async function init() {
      if (!gameCode) {
        router.push('/host');
        return;
      }
      
      console.log(`DEBUG: Host game page initialized with code ${gameCode}`);
      
      // Check authentication
      const userData = await getCurrentUser();
      if (!userData) {
        router.push('/auth/login');
        return;
      }
      
      setUser(userData);
      console.log(`DEBUG: Authenticated as ${userData.name}`);
      
      // Connect to Socket.io server
      const socketInstance = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      setSocket(socketInstance);
      
      // Setup event listeners
      socketInstance.on(EVENTS.CONNECT, () => {
        console.log(`DEBUG: Socket connected with ID ${socketInstance.id}`);
        
        // Join the game as host using the reconnection helper
        console.log(`DEBUG: Emitting join_host_room for ${gameCode}${isResuming ? ' (resuming)' : ''}`);
        
        // If we're resuming from the dashboard, show a message
        if (isResuming) {
          // alert('Reconnecting to your game session...');
        }
        
        handleHostReconnection(socketInstance, gameCode, userData, () => {
          console.log(`---------handleHostReconnection callback`);
          setIsLoading(false);
        });
      });
      
      // Handle reconnection events
      socketInstance.on('reconnect', () => {
        console.log(`DEBUG: Socket reconnected with new ID ${socketInstance.id}`);
        
        // Re-join the game room using the reconnection helper
        handleHostReconnection(socketInstance, gameCode, userData, () => {
          console.log(`DEBUG: Re-joined host room after reconnection`);
        });
      });
      
      // Handle disconnect events
      socketInstance.on('disconnect', (reason) => {
        console.log(`DEBUG: Socket disconnected. Reason: ${reason}`);
      });
      
      // Handle game state updates
      socketInstance.on(EVENTS.GAME_STATE_UPDATED, async (data: GameSession) => {
        console.log("-----------GAME STATE UPDATED-----------");
        console.log("Game state updated:", data);
        // console.log("Game state players:", JSON.stringify(data.players));
        
        // Update game status
        setGameStatus(data.status);
        
        // Ensure players array is properly updated
        if (data.players && Array.isArray(data.players)) {
          // console.log(`Received ${data.players.length} players from server`);
          
          // Make sure to preserve all player info and not overwrite it
          setPlayers(prevPlayers => {
            // Start with the new players array from the server
            const updatedPlayers = [...data.players];
            
            // Log the player transformation
            // console.log("Previous players:", JSON.stringify(prevPlayers));
            // console.log("Updated players:", JSON.stringify(updatedPlayers));
            
            return updatedPlayers;
          });
        } else {
          console.warn("No players array in game state update");
        }
        
        setCurrentQuestionIndex(data.currentQuestionIndex || 0);
        
        // If we have a quiz ID but don't have the quiz data yet, fetch it
        if (data.currentQuizId && data.status === 'question') {
          try {
            // Fetch the quiz
            const { fetchQuizById } = await import('@/lib/api');
            const quiz = await fetchQuizById(data.currentQuizId);
            
            if (quiz && quiz.questions) {
              setTotalQuestions(quiz.questions.length);
              
              // Set the current question
              if (quiz.questions.length > data.currentQuestionIndex) {
                setCurrentQuestion(quiz.questions[data.currentQuestionIndex]);
              }
            }
          } catch (error) {
            console.error('Error fetching quiz:', error);
          }
          
          // Only clear answers when moving to a new question, not when changing states
          if (data.status === 'question' && data.currentQuestionIndex !== currentQuestionIndex) {
            console.log("New question detected, clearing answers");
            setPlayerAnswers({});
            setHostAnswer('');
          } else {
            console.log("State change only, preserving answers");
          }
          
          // Log detailed info about answers to help debug
          console.log("playerAnswers in game state:", data.playerAnswers ? 
            `${Object.keys(data.playerAnswers).length} answers` : 
            "no answers array"
          );
        }
      });
      
      // Listen for answer revealed events from server
      socketInstance.on(EVENTS.ANSWER_REVEALED, (data: any) => {
        console.log("Answer revealed event received:", data);
        
        // If we have player answers in the response, update our state
        if (data.playerAnswers && Array.isArray(data.playerAnswers)) {
          console.log("Updating player answers from server:", data.playerAnswers);
          
          // Convert array of player answers to object format
          const answerObj: {[playerId: string]: string} = {};
          data.playerAnswers.forEach((answer: {playerId: string, answer: string}) => {
            answerObj[answer.playerId] = answer.answer;
          });
          
          // Make sure to preserve our local state as well
          setPlayerAnswers(prev => ({
            ...prev,
            ...answerObj
          }));
        }
      });
      
      // Handle player answers
      socketInstance.on(EVENTS.PLAYER_ANSWERED, (data: { playerId: string, answer: string }) => {
        console.log(`Player ${data.playerId} answered: ${data.answer}`);
        setPlayerAnswers(prev => {
          // Create updated answers object
          const updatedAnswers = {
            ...prev,
            [data.playerId]: data.answer
          };
          
          // Check if all non-host players have answered
          const nonHostPlayers = players.filter(p => !p.isHost);
          const allPlayersAnswered = nonHostPlayers.length > 0 && 
            nonHostPlayers.every(p => updatedAnswers[p.id] !== undefined);
          
          console.log(`Player ${data.playerId} answered. ${Object.keys(updatedAnswers).length} of ${nonHostPlayers.length} players have answered.`);
          
          // If all players have answered, auto-reveal after a short delay
          if (allPlayersAnswered) {
            console.log("All players have answered - auto-revealing answer in 2 seconds");
            
            // Wait 2 seconds before revealing the answer
            setTimeout(() => {
              handleRevealAnswer();
            }, 2000);
          }
          
          return updatedAnswers;
        });
      });
      
      // Handle timer updates from server
      socketInstance.on(EVENTS.TIMER_UPDATE, (data: { remaining?: number, questionId: string, totalSeconds?: number, isTimed?: boolean }) => {
        // console.log(`CLIENT: Received timer_update for question ${data.questionId}`, data);
        // console.log(`CLIENT: Current question ID: ${currentQuestion?.id || 'null'}, game status: ${gameStatus}`);
        
        // Check if this is an untimed quiz
        if (data.isTimed === false) {
          console.log('CLIENT: This is an untimed quiz - hiding timer');
          setTimer(-1); // Use -1 to indicate no timer
          return;
        }

        console.log(`CLIENT: Game status: ${gameStatus}, data.remaining: ${data.remaining}`);
        
        if (gameStatus === 'question' && data.remaining !== undefined) {
          console.log(`CLIENT: Updating timer to ${data.remaining}s`);
          setTimer(data.remaining);
        } else {
          // console.log(`CLIENT: Ignoring timer update - not in question state or missing data`);
        }
      });
      
      // Handle game ended event
      socketInstance.on(EVENTS.GAME_ENDED, (data: any) => {
        console.log("Game ended event received:", data);
        // Set game status to finished to show the GameFinished component
        setGameStatus('finished');
      });
      
      // Cleanup on unmount
      return () => {
        socketInstance.disconnect();
      };
    }
    
    init();
    console.log(`---------gameCode: ${gameCode}, router: ${JSON.stringify(router)}, currentQuestionIndex: ${currentQuestionIndex}, gameStatus: ${gameStatus}`);
  }, [gameCode, router, currentQuestionIndex, gameStatus]);

  // Effect to handle timer reaching zero
  useEffect(() => {
    // Only trigger timer end for timed quizzes (timer === 0)
    // Ignore for untimed quizzes (timer === -1)
    if (timer === 0 && gameStatus === 'question') {
      console.log('Timer reached zero, triggering handleTimerEnd');
      handleTimerEnd();
    }
  }, [timer, gameStatus]);
  
  // Handle timer end and auto-submission when timer reaches zero
  const handleTimerEnd = () => {
    if (!socket || !currentQuestion) return;
    
    console.log("Timer reached zero, submitting current answer state");
    
    try {
      // Submit whatever answer the host has (or empty string)
      handleSubmitAnswer(true);
      
      // Auto-reveal the answer when timer ends
      console.log("Timer expired - auto-revealing answer");
      handleRevealAnswer();
    } catch (error) {
      console.error("Error submitting answer when timer ended:", error);
    }
  };
  
  // Game control functions
  const handleNextQuestion = () => {
    if (!socket) return;
    
    if (currentQuestionIndex >= totalQuestions - 1) {
      // Show leaderboard at the end of the game
      socket.emit(EVENTS.SHOW_LEADERBOARD, { gameCode });
      
      // No waiting, go straight to end game
// socket.emit(EVENTS.END_GAME, { gameCode });
    } else {
      // Move to the next question
      setCurrentQuestionIndex(prev => prev + 1);
      socket.emit(EVENTS.NEXT_QUESTION, { gameCode });
    }
  };
  
  const handleSelectAnswer = (answer: string) => {
    setHostAnswer(answer);
  };
  
  const handleSubmitAnswer = (timeExpired = false) => {
    if (!socket || !currentQuestion) return;
    
    // If time expired and no answer is selected, force empty string submission
    // Otherwise, for manual submission, require an answer
    if (!hostAnswer && !timeExpired) return;
    
    // Use empty string if no answer and time expired, otherwise use selected answer
    const answerToSubmit = (!hostAnswer && timeExpired) ? "" : hostAnswer;

    console.log("-----------SUBMIT ANSWER-----------");
    console.log(`Submitting answer: ${answerToSubmit} with socket.id: ${socket.id}`);
    
    socket.emit(EVENTS.SUBMIT_ANSWER, {
      gameCode,
      questionId: currentQuestion.id,
      answer: answerToSubmit
    });
    
    // Add host's answer to the local state for immediate UI update
    // Store as both socket.id and 'host' to make it resilient to reconnection
    setPlayerAnswers(prev => ({
      ...prev,
      [socket.id as string]: answerToSubmit,
      'host': answerToSubmit // Use a constant key that won't change when socket reconnects
    }));
    
    // Reset the host answer for the next question
    setHostAnswer('');
    
    console.log(`Host submitted answer: ${answerToSubmit} ${timeExpired ? '(time expired)' : ''}`);
  };
  
  const handleRevealAnswer = () => {
    if (!socket) {
      console.error("Cannot reveal answer - socket is null");
      return;
    }
    
    if (!currentQuestion) {
      console.error("Cannot reveal answer - no current question");
      return;
    }
    
    console.log(`Revealing answer for question ${currentQuestion.id} in game ${gameCode}`);
    
    // First make sure any pending host answer is submitted
    // This ensures we don't lose the host's answer when manually revealing
    if (hostAnswer) {
      console.log("Submitting pending host answer before reveal");
      handleSubmitAnswer(false);
    }
    
    // Then reveal the answer
    socket.emit(EVENTS.REVEAL_ANSWER, { 
      gameCode
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
  
  // Function to handle the Play Again button on the leaderboard
  const handlePlayAgainFromLeaderboard = () => {
    if (!socket) return;
    
    // First end the current game to get the final results
    socket.emit(EVENTS.END_GAME, { gameCode });
  };
  
  const handleVote = (gameType: string) => {
    if (!socket) return;
    
    // Instead of voting, host directly decides and starts a new game
    socket.emit('start_new_game', {
      gameCode,
      gameType
    });
    
    // Update local state to reflect selection
    if (gameType === 'same_quiz') {
      setHostAnswer('voted_same_quiz');
    } else if (gameType === 'new_quiz_same_theme') {
      setHostAnswer('voted_new_quiz_same_theme');
    } else if (gameType === 'new_theme') {
      setHostAnswer('voted_new_theme');
    }
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
            <span className="font-medium">Players: {players.filter(p => !p.isHost).length} + Host</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left panel - Players */}
          <PlayerList players={players} />
          
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
                <GameTimer timer={timer} />
              )}
            </div>
            
            <div className="p-6">
              {/* Lobby state */}
              {gameStatus === 'lobby' && (
                <LobbyScreen gameCode={gameCode} socket={socket} />
              )}
              
              {/* Question state */}
              {gameStatus === 'question' && currentQuestion && (
                <QuestionDisplay
                  currentQuestion={currentQuestion}
                  playerAnswers={playerAnswers}
                  hostAnswer={hostAnswer}
                  socket={socket}
                  gameCode={gameCode}
                  onSelectAnswer={handleSelectAnswer}
                  onSubmitAnswer={() => handleSubmitAnswer(false)}
                  onRevealAnswer={handleRevealAnswer}
                  players={players}
                />
              )}
              
              {/* Answer reveal state */}
              {gameStatus === 'answer_reveal' && currentQuestion && (
                <AnswerReveal
                  currentQuestion={currentQuestion}
                  playerAnswers={playerAnswers}
                  socket={socket}
                  currentQuestionIndex={currentQuestionIndex}
                  totalQuestions={totalQuestions}
                  onNextQuestion={handleNextQuestion}
                />
              )}
              
              {/* Leaderboard state */}
              {gameStatus === 'leaderboard' && (
                <Leaderboard
                  players={players}
                  currentQuestionIndex={currentQuestionIndex}
                  totalQuestions={totalQuestions}
                  onNextQuestion={handleNextQuestion}
                  onEndGame={handleEndGame}
                  onPlayAgain={handlePlayAgainFromLeaderboard}
                />
              )}
              
              {/* Game finished state */}
              {gameStatus === 'finished' && (
                <GameFinished
                  socket={socket}
                  gameCode={gameCode}
                  hostAnswer={hostAnswer}
                  onVote={handleVote}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}