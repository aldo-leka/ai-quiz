import { Server as SocketIOServer, Socket } from 'socket.io';
import { EVENTS } from 'shared';
import { handleConnection } from './connection';
import { handleCreateGame } from './game';
import { handleJoinGame } from './game';
import { handleStartGame } from './game';
import { handleNextQuestion } from './quiz';
import { handleSubmitAnswer } from './quiz';

export function setupSocketHandlers(io: SocketIOServer) {
  io.on(EVENTS.CONNECT, (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Connection events
    handleConnection(socket, io);
    
    // Game session events
    socket.on(EVENTS.CREATE_GAME, (data) => handleCreateGame(socket, io, data));
    socket.on(EVENTS.JOIN_GAME, (data) => handleJoinGame(socket, io, data));
    socket.on(EVENTS.START_GAME, (data) => handleStartGame(socket, io, data));
    
    // Quiz events
    socket.on(EVENTS.NEXT_QUESTION, (data) => handleNextQuestion(socket, io, data));
    socket.on(EVENTS.SUBMIT_ANSWER, (data) => handleSubmitAnswer(socket, io, data));
    
    // Disconnection
    socket.on(EVENTS.DISCONNECT, () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Handle player disconnect logic
    });
  });
}
