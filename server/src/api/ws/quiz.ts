import { Server as SocketIOServer, Socket } from 'socket.io';
import { EVENTS, PlayerAnswer } from 'shared';
import { getGameSessionManager } from './connection';

/**
 * Handle a next question request
 */
export async function handleNextQuestion(socket: Socket, io: SocketIOServer, data: { gameCode: string }) {
  const { gameCode } = data;
  
  // Get the game session
  const gameSessionManager = getGameSessionManager();
  const gameSession = await gameSessionManager.getGameSession(gameCode);
  
  // Validate game exists
  if (!gameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game not found' });
    return;
  }
  
  // Validate user is the host
  if (gameSession.hostId !== socket.id) {
    socket.emit(EVENTS.ERROR, { message: 'Only the host can advance to the next question' });
    return;
  }
  
  try {
    // Move to the next question
    const success = await gameSessionManager.nextQuestion(gameCode);
    
    if (!success) {
      socket.emit(EVENTS.ERROR, { message: 'Failed to advance to next question' });
      return;
    }
    
    // Get updated game session
    const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
    
    if (!updatedGameSession) {
      socket.emit(EVENTS.ERROR, { message: 'Game session not found' });
      return;
    }
    
    console.log(`Next question: ${gameCode}, question ${updatedGameSession.currentQuestionIndex}`);
    console.log(`Players in session: ${updatedGameSession.players.length}`);
    
    // Add debug log to see the players
    console.log(`Players: ${JSON.stringify(updatedGameSession.players)}`);
    
    // Emit game state update to all players
    io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
    
    // If the game is now finished, emit game ended event
    if (updatedGameSession.status === 'finished') {
      const gameResult = await gameSessionManager.endGame(gameCode);
      if (gameResult) {
        io.to(gameCode).emit(EVENTS.GAME_ENDED, gameResult);
      }
    }
  } catch (error) {
    console.error('Error handling next question:', error);
    socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
  }
}

/**
 * Handle a submit answer request
 */
export async function handleSubmitAnswer(socket: Socket, io: SocketIOServer, data: { gameCode: string, questionId: string, answer: string | string[] }) {
  const { gameCode, questionId, answer } = data;
  
  // Get the game session
  const gameSessionManager = getGameSessionManager();
  const gameSession = await gameSessionManager.getGameSession(gameCode);
  
  // Validate game exists
  if (!gameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game not found' });
    return;
  }
  
  // Record the player's answer
  // In a real implementation, you would validate the answer and calculate the score
  const success = await gameSessionManager.recordAnswer(gameCode, socket.id, questionId, answer);
  
  if (!success) {
    socket.emit(EVENTS.ERROR, { message: 'Failed to record answer' });
    return;
  }
  
  // Emit player answered event to all players
  io.to(gameCode).emit(EVENTS.PLAYER_ANSWERED, { playerId: socket.id, answer });
  
  console.log(`Answer submitted: ${gameCode}, player ${socket.id}, question ${questionId}`);
  
  // Get the updated game session after recording the answer
  const updatedSession = await gameSessionManager.getGameSession(gameCode);
  if (!updatedSession) return;
  
  // Check if all connected players have answered (including host)
  const connectedPlayers = updatedSession.players.filter(p => p.isConnected);
  const playerAnswers = updatedSession.playerAnswers || [];
  const currentQuestionAnswers = playerAnswers.filter(a => a.questionId === questionId);
  
  // Count how many active players have answered
  const uniquePlayerIds = new Set(currentQuestionAnswers.map(a => a.playerId));
  const answeredCount = uniquePlayerIds.size;
  
  console.log(`Player answers: ${answeredCount} out of ${connectedPlayers.length} connected players`);
  
  // No auto-reveal - host will manually reveal the answer when ready
  // If all players have answered, notify the host that everyone has answered
  if (connectedPlayers.length > 0 && answeredCount >= connectedPlayers.length) {
    console.log(`All players have answered. Waiting for host to reveal answer...`);
    
    // Notify the host that all players have answered
    const hostSocket = Array.from(io.sockets.sockets.values()).find(s => s.id === updatedSession.hostId);
    if (hostSocket) {
      hostSocket.emit('all_players_answered', { gameCode });
    }
  }
}

/**
 * Handle a reveal answer request
 */
export async function handleRevealAnswer(socket: Socket, io: SocketIOServer, data: { gameCode: string }) {
  const { gameCode } = data;
  
  // Get the game session
  const gameSessionManager = getGameSessionManager();
  const gameSession = await gameSessionManager.getGameSession(gameCode);
  
  // Validate game exists
  if (!gameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game not found' });
    return;
  }
  
  // Validate user is the host
  if (gameSession.hostId !== socket.id) {
    socket.emit(EVENTS.ERROR, { message: 'Only the host can reveal the answer' });
    return;
  }
  
  try {
    // Reveal the answer
    const questionResult = await gameSessionManager.revealAnswer(gameCode);
    
    if (!questionResult) {
      socket.emit(EVENTS.ERROR, { message: 'Failed to reveal answer' });
      return;
    }
    
    // Get updated game session
    const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
    
    if (!updatedGameSession) {
      socket.emit(EVENTS.ERROR, { message: 'Game session not found' });
      return;
    }
    
    // Emit answer revealed event to all players
    io.to(gameCode).emit(EVENTS.ANSWER_REVEALED, questionResult);
    io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
    
    console.log(`Answer revealed: ${gameCode}`);
  } catch (error) {
    console.error('Error handling reveal answer:', error);
    socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
  }
}

/**
 * Handle a show leaderboard request
 */
export async function handleShowLeaderboard(socket: Socket, io: SocketIOServer, data: { gameCode: string }) {
  const { gameCode } = data;
  
  // Get the game session
  const gameSessionManager = getGameSessionManager();
  const gameSession = await gameSessionManager.getGameSession(gameCode);
  
  // Validate game exists
  if (!gameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game not found' });
    return;
  }
  
  // Validate user is the host
  if (gameSession.hostId !== socket.id) {
    socket.emit(EVENTS.ERROR, { message: 'Only the host can show the leaderboard' });
    return;
  }
  
  // Show the leaderboard
  const success = await gameSessionManager.showLeaderboard(gameCode);
  
  if (!success) {
    socket.emit(EVENTS.ERROR, { message: 'Failed to show leaderboard' });
    return;
  }
  
  // Get updated game session
  const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
  
  if (!updatedGameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game session not found' });
    return;
  }
  
  // Emit leaderboard updated event to all players
  io.to(gameCode).emit(EVENTS.LEADERBOARD_UPDATED, { players: updatedGameSession.players });
  io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
  
  console.log(`Leaderboard shown: ${gameCode}`);
}

/**
 * Handle an end game request
 */
export async function handleEndGame(socket: Socket, io: SocketIOServer, data: { gameCode: string }) {
  const { gameCode } = data;
  
  // Get the game session
  const gameSessionManager = getGameSessionManager();
  const gameSession = await gameSessionManager.getGameSession(gameCode);
  
  // Validate game exists
  if (!gameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game not found' });
    return;
  }
  
  // Validate user is the host
  if (gameSession.hostId !== socket.id) {
    socket.emit(EVENTS.ERROR, { message: 'Only the host can end the game' });
    return;
  }
  
  // End the game
  const gameResult = await gameSessionManager.endGame(gameCode);
  
  if (!gameResult) {
    socket.emit(EVENTS.ERROR, { message: 'Failed to end game' });
    return;
  }
  
  // Get updated game session
  const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
  
  if (!updatedGameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game session not found' });
    return;
  }
  
  // Emit game ended event to all players
  io.to(gameCode).emit(EVENTS.GAME_ENDED, gameResult);
  io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
  
  console.log(`Game ended: ${gameCode}`);
}
