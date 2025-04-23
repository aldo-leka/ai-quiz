import { Server as SocketIOServer } from 'socket.io';
import { GameSession, Player, EVENTS } from 'shared';
import { deleteGameSession } from '../../db/games';
import { SessionManager } from './SessionManager';

/**
 * Handles player-related functionality
 */
export class PlayerManager {
  private sessionManager: SessionManager;
  private io: SocketIOServer;

  constructor(sessionManager: SessionManager, io: SocketIOServer) {
    this.sessionManager = sessionManager;
    this.io = io;
  }

  /**
   * Add a player to a game session
   */
  public async addPlayer(
    gameCode: string, 
    playerId: string, 
    playerName: string, 
    playerAvatar: string,
    userId?: string
  ): Promise<Player | null> {
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      return null;
    }
    
    // Check if the game is already in progress
    if (session.status !== 'lobby') {
      return null;
    }
    
    // Check if the player name is already taken
    if (session.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
      return null;
    }
    
    // Create the player
    const player: Player = {
      id: playerId,
      name: playerName,
      avatar: playerAvatar,
      score: 0,
      isConnected: true,
      isHost: false,
      userId: userId // Store the database user ID if provided
    };
    
    // Add the player to the session
    session.players.push(player);
    this.sessionManager.socketToPlayer.set(playerId, { gameCode, playerId: player.id });
    
    // Update session activity timestamp
    this.sessionManager.updateSessionActivity(gameCode);
    
    // Persist the updated session
    await this.sessionManager.persistGameSession(session);
    
    return player;
  }

  /**
   * Handle a player disconnecting
   */
  public async handlePlayerDisconnect(socketId: string): Promise<void> {
    console.log(`DEBUG handlePlayerDisconnect: Player with socket ID ${socketId} disconnected`);
    
    const playerInfo = this.sessionManager.socketToPlayer.get(socketId);
    
    if (!playerInfo) {
      console.log(`DEBUG handlePlayerDisconnect: No player info found for socket ID ${socketId}`);
      return;
    }
    
    const { gameCode, playerId } = playerInfo;
    console.log(`DEBUG handlePlayerDisconnect: Found player in game ${gameCode} with ID ${playerId}`);
    
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      console.log(`DEBUG handlePlayerDisconnect: No session found for game code ${gameCode}`);
      return;
    }
    
    // Find the player
    const playerIndex = session.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      console.log(`DEBUG handlePlayerDisconnect: Player ${playerId} not found in session ${gameCode}`);
      return;
    }
    
    // Clean up the socket mapping immediately
    this.sessionManager.socketToPlayer.delete(socketId);
    
    // If the player is the host, handle differently (allow for reconnection)
    if (session.players[playerIndex].isHost) {
      console.log(`DEBUG handlePlayerDisconnect: Host ${playerId} disconnected from game ${gameCode}`);
      
      // Record the time the host disconnected
      session.hostDisconnectedAt = new Date().toISOString();
      
      // Mark the host as disconnected
      session.players[playerIndex].isConnected = false;
      
      // Update the session in memory
      this.sessionManager.sessions.set(gameCode, session);
      
      // Persist the updated session
      if (this.sessionManager.dbPersistenceEnabled) {
        await this.sessionManager.persistGameSession(session);
      }
      
      // Notify all players that the host is temporarily disconnected
      this.io.to(gameCode).emit(EVENTS.HOST_DISCONNECTED, {
        gameCode,
        message: 'The host has temporarily disconnected. Waiting for reconnection...'
      });
      
      // Schedule a timeout to end the game if the host doesn't reconnect
      // 5 minutes grace period for the host to reconnect (300000ms)
      setTimeout(async () => {
        try {
          // Get the fresh session state
          const currentSession = await this.sessionManager.getGameSession(gameCode);
          
          // If session still exists and host is still disconnected
          if (currentSession && currentSession.hostDisconnectedAt) {
            const disconnectTime = new Date(currentSession.hostDisconnectedAt).getTime();
            const now = new Date().getTime();
            const disconnectDuration = now - disconnectTime;
            
            // If it's been more than 5 minutes, end the game
            if (disconnectDuration > 300000) { // 5 minutes
              console.log(`DEBUG handlePlayerDisconnect: Host didn't reconnect after 5 minutes, ending game ${gameCode}`);
              
              // Clean up any timers for this game
              this.sessionManager.timerManager.clearQuestionTimer(gameCode);
              
              // End the game session
              const gameResult = await this.sessionManager.gameStateManager.endGame(gameCode);
              
              // Notify all players that the game is ending due to host absence
              this.io.to(gameCode).emit(EVENTS.ERROR, { 
                message: 'Host was disconnected for too long. The game has ended.' 
              });
              
              if (gameResult) {
                this.io.to(gameCode).emit(EVENTS.GAME_ENDED, gameResult);
              }
              
              // Tell all clients to return to lobby
              this.io.to(gameCode).emit(EVENTS.HOST_LEFT, { gameCode });
              
              // Remove the game session from memory
              this.sessionManager.sessions.delete(gameCode);
              
              // Remove from database if persistence is enabled
              if (this.sessionManager.dbPersistenceEnabled) {
                await deleteGameSession(currentSession.id);
              }
            }
          }
        } catch (error) {
          console.error(`Error in host disconnect timeout handler:`, error);
        }
      }, 300000); // 5 minutes
      
      return;
    }
    
    // For regular players, mark them as disconnected
    console.log(`DEBUG handlePlayerDisconnect: Player ${session.players[playerIndex].name} marked as disconnected`);
    session.players[playerIndex].isConnected = false;
    
    // Update the session in memory
    this.sessionManager.sessions.set(gameCode, session);
    
    // Persist the updated session
    if (this.sessionManager.dbPersistenceEnabled) {
      await this.sessionManager.persistGameSession(session);
    }
    
    // Notify other players
    this.io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, session);
  }

  // Voting-related methods removed

  /**
   * Handle host reconnection to an existing game
   */
  public async handleHostReconnection(socketId: string, gameCode: string, hostUserId?: string): Promise<GameSession | null> {
    console.log(`DEBUG handleHostReconnection: Attempting to reconnect host with socket ID ${socketId} to game ${gameCode}`);
    
    // Get the game session
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      console.log(`DEBUG handleHostReconnection: No session found for game code ${gameCode}`);
      return null;
    }
    
    // Find the host player
    const hostPlayerIndex = session.players.findIndex(p => p.isHost);
    
    if (hostPlayerIndex === -1) {
      console.log(`DEBUG handleHostReconnection: No host player found in session ${gameCode}`);
      return null;
    }
    
    const hostPlayer = session.players[hostPlayerIndex];
    
    // If hostUserId is provided, verify that it matches the session's hostUserId
    if (hostUserId && session.hostUserId && hostUserId !== session.hostUserId) {
      console.log(`DEBUG handleHostReconnection: User ID mismatch - provided: ${hostUserId}, expected: ${session.hostUserId}`);
      return null;
    }
    
    // Update the host's connection status and ID
    hostPlayer.isConnected = true;
    const oldHostId = hostPlayer.id;
    hostPlayer.id = socketId;
    
    // Update the game session's host ID
    session.hostId = socketId;
    
    // Clear the hostDisconnectedAt field
    delete session.hostDisconnectedAt;
    
    console.log(`DEBUG handleHostReconnection: Updated host ID from ${oldHostId} to ${socketId}`);
    
    // Update the socket mapping
    this.sessionManager.socketToPlayer.set(socketId, { gameCode, playerId: socketId });
    
    // Update the session in memory
    this.sessionManager.sessions.set(gameCode, session);
    
    // Persist the updated session
    if (this.sessionManager.dbPersistenceEnabled) {
      await this.sessionManager.persistGameSession(session);
    }
    
    // Notify all players that the host has reconnected
    this.io.to(gameCode).emit(EVENTS.HOST_RECONNECTED, {
      gameCode,
      message: 'The host has reconnected to the game.'
    });
    
    // Send updated game state
    this.io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, session);
    
    return session;
  }
}