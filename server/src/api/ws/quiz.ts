import { Server as SocketIOServer, Socket } from 'socket.io';
import { EVENTS } from 'shared';

export function handleNextQuestion(socket: Socket, io: SocketIOServer, data: any) {
  // Move to the next question
  // This is a placeholder - will be implemented later
  const { gameCode } = data;
  
  // Validate user is the host
  
  // Logic to get next question
  
  // Emit next question event to all in the room
  io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, { status: 'question' });
}

export function handleSubmitAnswer(socket: Socket, io: SocketIOServer, data: any) {
  // Handle player's answer submission
  // This is a placeholder - will be implemented later
  const { gameCode, answer } = data;
  
  // Logic to process and store the answer
  
  // Emit player answered event to all in the room
  io.to(gameCode).emit(EVENTS.PLAYER_ANSWERED, { playerId: socket.id });
}
