import { Server as SocketIOServer, Socket } from 'socket.io';
import { EVENTS } from 'shared';
import { handleConnection, initGameSessionManager, getGameSessionManager } from './connection';
import { handleCreateGame, handleJoinGame, handleStartGame } from './game';
import { 
  handleNextQuestion, 
  handleSubmitAnswer, 
  handleRevealAnswer, 
  handleShowLeaderboard, 
  handleEndGame 
} from './quiz';

/**
 * Set up socket.io event handlers
 */
export function setupSocketHandlers(io: SocketIOServer) {
  // Initialize the game session manager
  initGameSessionManager(io);
  
  io.on(EVENTS.CONNECT, (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Connection events
    handleConnection(socket, io);
    
    // Game session events
    socket.on(EVENTS.CREATE_GAME, (data) => {
      try {
        handleCreateGame(socket, io, data);
      } catch (error) {
        console.error('Error in CREATE_GAME handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
      }
    });
    
    socket.on(EVENTS.JOIN_GAME, async (data) => {
      try {
        await handleJoinGame(socket, io, data);
      } catch (error) {
        console.error('Error in JOIN_GAME handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
      }
    });
    
    socket.on(EVENTS.START_GAME, async (data) => {
      try {
        await handleStartGame(socket, io, data);
      } catch (error) {
        console.error('Error in START_GAME handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
      }
    });
    
    // Quiz events
    socket.on(EVENTS.NEXT_QUESTION, async (data) => {
      try {
        await handleNextQuestion(socket, io, data);
      } catch (error) {
        console.error('Error in NEXT_QUESTION handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
      }
    });
    
    socket.on(EVENTS.SUBMIT_ANSWER, async (data) => {
      try {
        await handleSubmitAnswer(socket, io, data);
      } catch (error) {
        console.error('Error in SUBMIT_ANSWER handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
      }
    });
    
    socket.on(EVENTS.REVEAL_ANSWER, async (data) => {
      try {
        await handleRevealAnswer(socket, io, data);
      } catch (error) {
        console.error('Error in REVEAL_ANSWER handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
      }
    });
    
    socket.on(EVENTS.SHOW_LEADERBOARD, async (data) => {
      try {
        await handleShowLeaderboard(socket, io, data);
      } catch (error) {
        console.error('Error in SHOW_LEADERBOARD handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
      }
    });
    
    socket.on(EVENTS.END_GAME, async (data) => {
      try {
        await handleEndGame(socket, io, data);
      } catch (error) {
        console.error('Error in END_GAME handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Internal server error' });
      }
    });
    
    // Start a new game - host decides the game type
    socket.on('start_new_game', async (data: { gameCode: string, gameType: string }) => {
      try {
        const { gameCode, gameType } = data;
        const gameSessionManager = getGameSessionManager();
        const gameSession = await gameSessionManager.getGameSession(gameCode);
        
        if (!gameSession) {
          socket.emit(EVENTS.ERROR, { message: 'Game not found' });
          return;
        }
        
        // Ensure the requester is the host
        if (gameSession.hostId !== socket.id) {
          socket.emit(EVENTS.ERROR, { message: 'Only the host can start a new game' });
          return;
        }
        
        // Send the next game type to clients
        io.to(gameCode).emit('next_game_selected', { nextGameType: gameType });
        
        // Reset game session for the new game
        gameSession.status = 'lobby';
        gameSession.currentQuestionIndex = 0;
        gameSession.playerAnswers = [];
        gameSession.questionResults = [];
        gameSession.startedAt = null;
        gameSession.endedAt = null;
        gameSession.lastActivityAt = new Date().toISOString();
        
        // If using the same quiz, we keep the currentQuizId
        // If not, we'll set it to null and the client will request a new one
        if (gameType !== 'same_quiz' && gameType !== 'new_quiz_same_theme') {
          gameSession.currentQuizId = null;
        }
        
        // Reset player scores
        gameSession.players.forEach(player => {
          player.score = 0;
        });
        
        // Store the updated session in memory
        gameSessionManager.sessions.set(gameCode, gameSession);
        
        // Persist the updated session
        if (gameSessionManager.dbPersistenceEnabled) {
          await gameSessionManager.persistGameSession(gameSession);
        }
        
        // Notify clients about the reset game
        io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, gameSession);
      } catch (error) {
        console.error('Error in start_new_game handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Failed to start new game' });
      }
    });
    
    // Add a special reconnect handler for players
    socket.on('reconnect_player', async (data: { gameCode: string, playerName: string, playerAvatar: string }) => {
      try {
        const { gameCode, playerName, playerAvatar } = data;
        console.log(`DEBUG: Player attempting to reconnect to room: ${gameCode} as ${playerName}`);
        
        // Get the game session
        const gameSessionManager = getGameSessionManager();
        const gameSession = await gameSessionManager.getGameSession(gameCode);
        
        if (gameSession) {
          // Find if a player with this name exists
          const existingPlayer = gameSession.players.find(p => 
            p.name.toLowerCase() === playerName.toLowerCase() && !p.isHost
          );
          
          if (existingPlayer) {
            console.log(`DEBUG: Found existing player ${playerName} with original ID ${existingPlayer.id}`);
            
            // Update the player's connection status and ID
            existingPlayer.isConnected = true;
            const oldPlayerId = existingPlayer.id;
            existingPlayer.id = socket.id;
            
            console.log(`DEBUG: Reconnected player ${playerName} with new ID ${socket.id}`);
            
            // Clean up old mapping if it exists
            try {
              gameSessionManager.socketToPlayer.delete(oldPlayerId);
              console.log(`DEBUG: Cleaned up old socket mapping for ${oldPlayerId}`);
            } catch (error) {
              console.error(`DEBUG: Error cleaning up old socket mapping:`, error);
            }
            
            // Add new mapping
            try {
              gameSessionManager.socketToPlayer.set(socket.id, { gameCode, playerId: socket.id });
              console.log(`DEBUG: Added new socket mapping for ${socket.id}`);
            } catch (error) {
              console.error(`DEBUG: Error setting socket mapping:`, error);
            }
            
            // Store the updated session in memory
            gameSessionManager.sessions.set(gameCode, gameSession);
            
            // Persist the updated session
            if (gameSessionManager.dbPersistenceEnabled) {
              await gameSessionManager.persistGameSession(gameSession);
            }
            
            // Join the socket to the room
            socket.join(gameCode);
            console.log(`DEBUG: Socket ${socket.id} joined room ${gameCode}`);
            
            // Send the current game state to the player
            socket.emit(EVENTS.GAME_STATE_UPDATED, gameSession);
            
            // Broadcast the updated player list to all clients in the room
            io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, gameSession);
            
            // Emit a player joined event for this reconnected player
            socket.to(gameCode).emit(EVENTS.PLAYER_JOINED, { player: existingPlayer });
          } else {
            // No existing player with this name, treat as a new join
            console.log(`DEBUG: No existing player ${playerName} found, treating as new join`);
            await handleJoinGame(socket, io, { gameCode, playerName, playerAvatar });
          }
        } else {
          console.log(`DEBUG: No game session found for code ${gameCode}`);
          socket.emit(EVENTS.ERROR, { message: 'Game not found' });
        }
      } catch (error) {
        console.error('Error in reconnect_player handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Failed to reconnect to game' });
      }
    });
    
    // Join host room for existing game (for reconnection)
    socket.on('join_host_room', async (data: { gameCode: string, hostUserId?: string }) => {
      try {
        const { gameCode, hostUserId } = data;
        console.log(`DEBUG: Host attempting to rejoin room: ${gameCode}`);
        
        // Use the new host reconnection method
        const gameSessionManager = getGameSessionManager();
        const gameSession = await gameSessionManager.handleHostReconnection(socket.id, gameCode, hostUserId);
        
        if (gameSession) {
          // Join the room
          socket.join(gameCode);
          console.log(`DEBUG: Host socket ${socket.id} rejoined room ${gameCode} successfully`);
          
          // Send the current state to the host
          socket.emit(EVENTS.GAME_STATE_UPDATED, gameSession);
          
          // Log the player details being sent to the host
          console.log(`DEBUG: Sending game state with ${gameSession.players.length} players to host`);
          console.log(`DEBUG: Players: ${JSON.stringify(gameSession.players.map(p => ({ id: p.id, name: p.name, connected: p.isConnected })))}`);
        } else {
          console.log(`DEBUG: Failed to reconnect host to game ${gameCode}`);
          socket.emit(EVENTS.ERROR, { message: 'Game not found or you are not authorized to join as host' });
        }
      } catch (error) {
        console.error('Error in join_host_room handler:', error);
        socket.emit(EVENTS.ERROR, { message: 'Failed to join game as host' });
      }
    });
  });
}
