import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameSessionManager } from '../../game/GameSessionManager';
import { EVENTS } from 'shared';

// Create the game session manager
let gameSessionManager: GameSessionManager | null = null;

/**
 * Initialize the game session manager
 */
export function initGameSessionManager(io: SocketIOServer): void {
  gameSessionManager = new GameSessionManager(io);
}

/**
 * Get the game session manager instance
 */
export function getGameSessionManager(): GameSessionManager {
  if (!gameSessionManager) {
    throw new Error('Game session manager not initialized');
  }
  return gameSessionManager;
}

/**
 * Handle a new socket connection
 */
export function handleConnection(socket: Socket, io: SocketIOServer) {
  console.log(`New connection: ${socket.id}`);
  
  // Handle disconnection
  socket.on(EVENTS.DISCONNECT, () => {
    console.log(`Disconnected: ${socket.id}`);
    
    // Handle player disconnection in game session manager
    if (gameSessionManager) {
      gameSessionManager.handlePlayerDisconnect(socket.id).catch(error => {
        console.error(`Error handling player disconnect for ${socket.id}:`, error);
      });
    }
  });
}
