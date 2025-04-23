import { Server as SocketIOServer } from 'socket.io';
import { GameResult } from 'shared';
import { SessionManager } from './SessionManager';
import { QuestionManager } from './QuestionManager';
import { deleteGameSession } from '../../db/games';

/**
 * Manages game state transitions and lifecycle
 */
export class GameStateManager {
  private sessionManager: SessionManager;
  private io: SocketIOServer;
  private questionManager: QuestionManager;

  constructor(sessionManager: SessionManager, io: SocketIOServer, questionManager: QuestionManager) {
    this.sessionManager = sessionManager;
    this.io = io;
    this.questionManager = questionManager;
  }

  /**
   * Start a game session
   */
  public async startGame(gameCode: string): Promise<boolean> {
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      return false;
    }
    
    // Update the game status
    session.status = 'question';
    session.startedAt = new Date().toISOString();
    session.lastActivityAt = new Date().toISOString(); // Update activity timestamp
    session.currentQuestionIndex = 0;
    
    // Reset player scores
    session.players.forEach(player => {
      player.score = 0;
    });
    
    // Persist the updated session
    await this.sessionManager.persistGameSession(session);
    
    return true;
  }

  /**
   * Show the leaderboard
   */
  public async showLeaderboard(gameCode: string): Promise<boolean> {
    // Clear any existing question timer
    this.sessionManager.timerManager.clearQuestionTimer(gameCode);
    
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      return false;
    }
    
    // Update the game status
    session.status = 'leaderboard';
    session.lastActivityAt = new Date().toISOString(); // Update activity timestamp
    
    return true;
  }

  /**
   * End a game session
   */
  public async endGame(gameCode: string): Promise<GameResult | null> {
    // Clear any existing question timer
    this.sessionManager.timerManager.clearQuestionTimer(gameCode);
    
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session || !session.currentQuizId) {
      return null;
    }
    
    // Update the game status
    session.status = 'finished';
    session.endedAt = new Date().toISOString();
    session.lastActivityAt = new Date().toISOString(); // Update activity timestamp
    
    // Initialize voting options if not already set
    if (!session.nextGameOptions) {
      session.nextGameOptions = [
        'same_quiz',
        'new_quiz_same_theme',
        'new_theme'
      ];
    }
    
    // Sort players by score (highest first)
    session.players.sort((a, b) => b.score - a.score);
    
    // Create the game result
    const gameResult: GameResult = {
      gameId: session.id,
      quizId: session.currentQuizId,
      players: session.players,
      questionResults: session.questionResults || [],
      startedAt: session.startedAt || new Date().toISOString(),
      endedAt: session.endedAt
    };
    
    // Asynchronously save the game result to the database
    // We don't await this to avoid blocking the response
    this.saveGameResult(gameResult).catch(error => {
      console.error(`Failed to save game result:`, error);
    });
    
    return gameResult;
  }
  
  /**
   * Save game result to the database
   */
  private async saveGameResult(gameResult: GameResult): Promise<void> {
    try {
      // Save game result to database
      // This is where you would implement persistence logic
      // For example, calling a database service to store the result
      
      // This is a placeholder implementation
      console.log(`Game ${gameResult.gameId} completed with ${gameResult.players.length} players`);
      console.log(`Winner: ${gameResult.players[0]?.name} with score ${gameResult.players[0]?.score}`);
    } catch (error) {
      console.error(`Error saving game result:`, error);
      throw error;
    }
  }
}