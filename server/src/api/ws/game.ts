import { Server as SocketIOServer, Socket } from 'socket.io';
import { EVENTS, CreateGameRequest, JoinGameRequest, GameSession } from 'shared';
import { getGameSessionManager } from './connection';

/**
 * Handle a create game request
 */
export function handleCreateGame(socket: Socket, io: SocketIOServer, data: CreateGameRequest) {
  const { hostName, hostAvatar, hostUserId } = data;
  
  // Create a new game session
  const gameSessionManager = getGameSessionManager();

  console.log(`---------socket.id when creating game: ${socket.id}`);

  const gameSession = gameSessionManager.createGameSession(
    socket.id,
    hostName,
    hostAvatar,
    data.quizId,
    hostUserId  // Pass the user ID to store in the game session
  );
  
  // Join the socket to the room
  socket.join(gameSession.code);
  
  // Emit game created event
  socket.emit(EVENTS.GAME_CREATED, { 
    roomCode: gameSession.code,
    gameSession
  });
  
  console.log(`Game created: ${gameSession.code} by ${hostName}${hostUserId ? ` (User ID: ${hostUserId})` : ''}`);
}

/**
 * Handle a join game request
 */
export async function handleJoinGame(socket: Socket, io: SocketIOServer, data: JoinGameRequest) {
  const { gameCode, playerName, playerAvatar, userId } = data;
  
  // Get the game session
  const gameSessionManager = getGameSessionManager();
  const gameSession = await gameSessionManager.getGameSession(gameCode);
  
  // Validate game exists
  if (!gameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game not found' });
    return;
  }
  
  // Validate game is in lobby state
  if (gameSession.status !== 'lobby') {
    socket.emit(EVENTS.ERROR, { message: 'Game has already started' });
    return;
  }
  
  // Check if this user is the host trying to join as a player
  if (userId && gameSession.hostUserId === userId) {
    socket.emit(EVENTS.ERROR, { 
      message: 'You are the host of this game. Use the "Resume Hosting" option instead.',
      code: 'HOST_ATTEMPT_JOIN_AS_PLAYER'
    });
    return;
  }
  
  // Validate player name is available
  if (gameSession.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
    socket.emit(EVENTS.ERROR, { message: 'Player name is already taken' });
    return;
  }
  
  // Add player to game
  const player = await gameSessionManager.addPlayer(gameCode, socket.id, playerName, playerAvatar, userId);
  
  if (!player) {
    socket.emit(EVENTS.ERROR, { message: 'Failed to join game' });
    return;
  }
  
  // Join the socket to the room
  socket.join(gameCode);
  
  // Emit player joined event to all players
  io.to(gameCode).emit(EVENTS.PLAYER_JOINED, { player });
  
  // Get updated game session after adding the player
  const updatedGameSession = await gameSessionManager.getGameSession(gameCode);

  if (updatedGameSession) {
    // Emit game state to the joining player
    socket.emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
  }
  
  console.log(`Player joined: ${playerName} to game ${gameCode}${userId ? ` (User ID: ${userId})` : ''}`);
}

/**
 * Handle a start game request
 */
export async function handleStartGame(socket: Socket, io: SocketIOServer, data: { gameCode: string }) {
  const { gameCode } = data;
  
  // Get the game session
  const gameSessionManager = getGameSessionManager();
  const gameSession = await gameSessionManager.getGameSession(gameCode);
  
  // Validate game exists
  if (!gameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game not found' });
    return;
  }
  
  console.log(`---------gameSession.hostId: ${gameSession.hostId}`);
  console.log(`---------socket.id: ${socket.id}`);

  // Validate user is the host
  if (gameSession.hostId !== socket.id) {
    socket.emit(EVENTS.ERROR, { message: 'Only the host can start the game' });
    return;
  }
  
  // Start the game
  const success = await gameSessionManager.startGame(gameCode);
  
  if (!success) {
    socket.emit(EVENTS.ERROR, { message: 'Failed to start game' });
    return;
  }
  
  // Get updated game session
  const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
  
  if (!updatedGameSession) {
    socket.emit(EVENTS.ERROR, { message: 'Game session not found' });
    return;
  }
  
  // Debug logs to trace player information
  console.log(`Game started: ${gameCode}`);
  console.log(`Players in session: ${updatedGameSession.players.length}`);
  console.log(`Players: ${JSON.stringify(updatedGameSession.players)}`);
  
  // Emit game started event to all players
  io.to(gameCode).emit(EVENTS.GAME_STARTED, { gameCode });
  io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
  
  // Start timer for the first question without advancing to next question
  await gameSessionManager.startCurrentQuestionTimer(gameCode);
}
