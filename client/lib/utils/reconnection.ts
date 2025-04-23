import { Socket } from 'socket.io-client';
import { User } from 'shared';

/**
 * Helper function to handle host reconnection logic
 * 
 * @param socket - The socket.io socket instance
 * @param gameCode - The game room code to rejoin
 * @param user - The current user object
 * @param callback - Optional callback function when reconnection is successful
 */
export function handleHostReconnection(
  socket: Socket, 
  gameCode: string, 
  user: User | null,
  callback?: () => void
): void {
  if (!socket || !gameCode) {
    console.error('Socket or game code not available for reconnection');
    return;
  }

  // Add a short delay to ensure the connection is fully established
  setTimeout(() => {
    socket.emit('join_host_room', { 
      gameCode,
      hostUserId: user?.id // Pass the user ID for authentication if available
    });
    
    console.log(`Attempted to rejoin game ${gameCode} as host${user ? ` (User: ${user.name})` : ''}`);
    
    if (callback) {
      callback();
    }
  }, 500);
}

/**
 * Helper function to handle player reconnection logic
 * 
 * @param socket - The socket.io socket instance
 * @param gameCode - The game room code to rejoin
 * @param playerName - The player's name
 * @param playerAvatar - The player's avatar
 * @param callback - Optional callback function when reconnection is successful
 */
export function handlePlayerReconnection(
  socket: Socket,
  gameCode: string,
  playerName: string,
  playerAvatar: string,
  callback?: () => void
): void {
  if (!socket || !gameCode || !playerName) {
    console.error('Socket, game code, or player name not available for reconnection');
    return;
  }

  // Add a short delay to ensure the connection is fully established
  setTimeout(() => {
    socket.emit('reconnect_player', {
      gameCode,
      playerName,
      playerAvatar: playerAvatar || '👤'
    });
    
    console.log(`Attempted to rejoin game ${gameCode} as player ${playerName}`);
    
    if (callback) {
      callback();
    }
  }, 500);
}