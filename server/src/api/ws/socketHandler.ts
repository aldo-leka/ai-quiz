import { Server as SocketIOServer, Socket } from 'socket.io';
import { EVENTS, GameSession, QuestionResult, CreateGameRequest, JoinGameRequest } from 'shared';
import { GameSessionManager } from '../../game/GameSessionManager';

// Singleton instance of GameSessionManager
let gameSessionManager: GameSessionManager;

/**
 * Initialize the game session manager
 */
export function initGameSessionManager(io: SocketIOServer) {
  gameSessionManager = new GameSessionManager(io);
  return gameSessionManager;
}

/**
 * Get the game session manager instance
 */
export function getGameSessionManager(): GameSessionManager {
  return gameSessionManager;
}

/**
 * Core Socket.IO handler that sets up all event listeners
 */
export function setupSocketHandlers(io: SocketIOServer) {
  // Initialize the game session manager
  initGameSessionManager(io);
  
  // Connection event
  io.on(EVENTS.CONNECT, (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Handle disconnection
    socket.on(EVENTS.DISCONNECT, async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      await gameSessionManager.handlePlayerDisconnect(socket.id);
    });

    // GAME MANAGEMENT EVENTS
    
    // Create a new game
    socket.on(EVENTS.CREATE_GAME, (data: CreateGameRequest) => {
      const { hostName, hostAvatar, hostUserId, quizId } = data;
      
      // Create a new game session
      const gameSession = gameSessionManager.createGameSession(
        socket.id,
        hostName,
        hostAvatar,
        quizId,
        hostUserId
      );
      
      // Join the socket to the room
      socket.join(gameSession.code);
      
      // Emit game created event
      socket.emit(EVENTS.GAME_CREATED, { 
        roomCode: gameSession.code,
        gameSession
      });
      
      console.log(`Game created: ${gameSession.code} by ${hostName}`);
    });
    
    // Join an existing game
    socket.on(EVENTS.JOIN_GAME, async (data: JoinGameRequest) => {
      const { gameCode, playerName, playerAvatar, userId } = data;
      
      // Get the game session
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
      
      // Check if user is the host trying to join as player
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
      
      // Get updated game session
      const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
      if (updatedGameSession) {
        socket.emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
      }
      
      console.log(`Player joined: ${playerName} to game ${gameCode}`);
    });
    
    // Start a game
    socket.on(EVENTS.START_GAME, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get the game session
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      // Validate game exists
      if (!gameSession) {
        socket.emit(EVENTS.ERROR, { message: 'Game not found' });
        return;
      }
      
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
      
      // Emit game started events
      io.to(gameCode).emit(EVENTS.GAME_STARTED, { gameCode });
      io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
      
      // Start timer for the first question without advancing to next question
      await gameSessionManager.startCurrentQuestionTimer(gameCode);
    });
    
    // QUIZ NAVIGATION EVENTS
    
    // Move to next question
    socket.on(EVENTS.NEXT_QUESTION, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get the game session
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      // Validate game exists and user is host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // Go to next question
      const success = await gameSessionManager.nextQuestion(gameCode);
      
      if (success) {
        // Get updated game session
        const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
        
        if (updatedGameSession) {
          // Emit updated state to all clients
          io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
        }
      }
    });
    
    // Submit an answer
    socket.on(EVENTS.SUBMIT_ANSWER, async (data: { gameCode: string, questionId: string, answer: string | string[] }) => {
      const { gameCode, questionId, answer } = data;
      
      // Get the game session
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      // Validate game exists
      if (!gameSession) {
        socket.emit(EVENTS.ERROR, { message: 'Game not found' });
        return;
      }
      
      // Find the player
      const playerId = socket.id;
      const player = gameSession.players.find(p => p.id === playerId);
      
      if (!player) {
        socket.emit(EVENTS.ERROR, { message: 'Player not found' });
        return;
      }
      
      // Calculate time to answer
      const timer = gameSessionManager.timerManager.getTimerInfo(gameCode);
      let timeToAnswer: number | undefined;
      
      if (timer) {
        timeToAnswer = Date.now() - timer.timerStarted;
      }
      
      // Record the answer
      const success = await gameSessionManager.recordAnswer(gameCode, playerId, questionId, answer, timeToAnswer);
      
      if (success) {
        // Notify all players that this player has answered
        io.to(gameCode).emit(EVENTS.PLAYER_ANSWERED, { 
          playerId,
          answer,
          playerName: player.name
        });
        
        // Check if all players have answered
        const allPlayers = gameSession.players;
        const currentAnswers = gameSession.playerAnswers || [];
        const answeredPlayers = new Set(currentAnswers.map(a => a.playerId));
        
        const allPlayersAnswered = allPlayers.every(p => answeredPlayers.has(p.id));
        
        if (allPlayersAnswered) {
          io.to(gameCode).emit(EVENTS.ALL_PLAYERS_ANSWERED);
        }
      }
    });
    
    // Reveal the answer
    socket.on(EVENTS.REVEAL_ANSWER, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get the game session
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      // Validate game exists and user is host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // Reveal the answer
      const result: QuestionResult | null = await gameSessionManager.revealAnswer(gameCode);
      
      if (result) {
        // Get updated game session
        const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
        
        if (updatedGameSession) {
          // Emit updated state and answer revealed event
          io.to(gameCode).emit(EVENTS.ANSWER_REVEALED, result);
          io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
        }
      }
    });
    
    // Show leaderboard
    socket.on(EVENTS.SHOW_LEADERBOARD, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get the game session
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      // Validate game exists and user is host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // Show leaderboard
      const success = await gameSessionManager.showLeaderboard(gameCode);
      
      if (success) {
        // Get updated game session
        const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
        
        if (updatedGameSession) {
          // Emit updated state
          io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
          io.to(gameCode).emit(EVENTS.LEADERBOARD_UPDATED);
        }
      }
    });
    
    // End the game
    socket.on(EVENTS.END_GAME, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get the game session
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      // Validate game exists and user is host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // End the game
      const result = await gameSessionManager.endGame(gameCode);
      
      if (result) {
        // Get updated game session
        const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
        
        if (updatedGameSession) {
          // Emit game ended events
          io.to(gameCode).emit(EVENTS.GAME_ENDED, result);
          io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
        }
      }
    });
    
    // RECONNECTION EVENTS
    
    // Handle host reconnection
    socket.on('join_host_room', async (data: { gameCode: string, hostUserId?: string }) => {
      const { gameCode, hostUserId } = data;
      
      // Handle host reconnection
      const gameSession = await gameSessionManager.handleHostReconnection(socket.id, gameCode, hostUserId);
      
      if (gameSession) {
        // Join the socket to the room
        socket.join(gameCode);
        
        // Send current game state
        socket.emit(EVENTS.GAME_STATE_UPDATED, gameSession);
      } else {
        socket.emit(EVENTS.ERROR, { message: 'Game not found or you are not the host' });
      }
    });
    
    // Handle player reconnection
    socket.on('reconnect_player', async (data: { gameCode: string, playerName: string, playerAvatar: string }) => {
      const { gameCode, playerName, playerAvatar } = data;
      
      // Get the game session
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      if (!gameSession) {
        socket.emit(EVENTS.ERROR, { message: 'Game not found' });
        return;
      }
      
      // Find the player
      const existingPlayer = gameSession.players.find(p => 
        p.name.toLowerCase() === playerName.toLowerCase() && !p.isHost
      );
      
      if (existingPlayer) {
        // Update player connection
        const oldPlayerId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.isConnected = true;
        
        // Update mappings
        gameSessionManager.socketToPlayer.delete(oldPlayerId);
        gameSessionManager.socketToPlayer.set(socket.id, { gameCode, playerId: socket.id });
        
        // Update session
        gameSessionManager.sessions.set(gameCode, gameSession);
        
        // Join the room
        socket.join(gameCode);
        
        // Send game state
        socket.emit(EVENTS.GAME_STATE_UPDATED, gameSession);
        
        // Notify other players
        io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, gameSession);
        socket.to(gameCode).emit(EVENTS.PLAYER_JOINED, { player: existingPlayer });
      } else {
        // Treat as new join
        await gameSessionManager.addPlayer(gameCode, socket.id, playerName, playerAvatar);
        
        // Join the room
        socket.join(gameCode);
        
        // Get updated game session
        const updatedGameSession = await gameSessionManager.getGameSession(gameCode);
        
        if (updatedGameSession) {
          socket.emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
        }
      }
    });
    
    // Start a new game after finishing one
    socket.on('start_new_game', async (data: { gameCode: string, gameType: string }) => {
      const { gameCode, gameType } = data;
      
      // Get the game session
      const gameSession = await gameSessionManager.getGameSession(gameCode);
      
      // Validate game exists and user is host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // Notify clients about the next game type
      io.to(gameCode).emit('next_game_selected', { nextGameType: gameType });
      
      // Reset the game session
      gameSession.status = 'lobby';
      gameSession.currentQuestionIndex = 0;
      gameSession.playerAnswers = [];
      gameSession.questionResults = [];
      gameSession.startedAt = null;
      gameSession.endedAt = null;
      gameSession.lastActivityAt = new Date().toISOString();
      
      // Handle quiz ID based on game type
      if (gameType !== 'same_quiz' && gameType !== 'new_quiz_same_theme') {
        gameSession.currentQuizId = null;
      }
      
      // Reset player scores
      gameSession.players.forEach(player => {
        player.score = 0;
      });
      
      // Store the updated session
      gameSessionManager.sessions.set(gameCode, gameSession);
      
      // Persist the session if enabled
      if (gameSessionManager.dbPersistenceEnabled) {
        await gameSessionManager.persistGameSession(gameSession);
      }
      
      // Notify clients
      io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, gameSession);
    });
  });
}