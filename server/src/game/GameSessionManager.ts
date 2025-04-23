import { Server as SocketIOServer } from 'socket.io';
import { GameSession, Player, QuestionResult, GameResult } from 'shared';
import { SessionManager } from './managers/SessionManager';
import { PlayerManager } from './managers/PlayerManager';
import { TimerManager } from './managers/TimerManager';
import { QuestionManager } from './managers/QuestionManager';
import { GameStateManager } from './managers/GameStateManager';

/**
 * Manages game sessions for the multiplayer quiz game
 * This is the main entry point that delegates to specialized managers
 */
export class GameSessionManager {
  private sessionManager: SessionManager;
  private playerManager: PlayerManager;
  public timerManager: TimerManager;
  private questionManager: QuestionManager;
  private gameStateManager: GameStateManager;
  
  // Expose these properties to maintain compatibility with existing code
  public get sessions(): Map<string, GameSession> {
    return this.sessionManager.sessions;
  }
  
  public get socketToPlayer(): Map<string, { gameCode: string, playerId: string }> {
    return this.sessionManager.socketToPlayer;
  }
  
  public get dbPersistenceEnabled(): boolean {
    return this.sessionManager.dbPersistenceEnabled;
  }
  
  public set dbPersistenceEnabled(value: boolean) {
    this.sessionManager.dbPersistenceEnabled = value;
  }
  
  constructor(io: SocketIOServer) {
    // Create the core session manager
    this.sessionManager = new SessionManager(io);
    
    // Get references to all the specialized managers
    this.playerManager = this.sessionManager.playerManager;
    this.timerManager = this.sessionManager.timerManager;
    this.questionManager = this.sessionManager.questionManager;
    this.gameStateManager = this.sessionManager.gameStateManager;
  }
  
  // ======== SESSION MANAGEMENT ========
  
  /**
   * Create a new game session
   */
  public createGameSession(hostId: string, hostName: string, hostAvatar: string, quizId?: string, hostUserId?: string): GameSession {
    return this.sessionManager.createGameSession(hostId, hostName, hostAvatar, quizId, hostUserId);
  }
  
  /**
   * Get a game session by its code
   */
  public async getGameSession(code: string): Promise<GameSession | undefined> {
    return this.sessionManager.getGameSession(code);
  }
  
  /**
   * Get all active game sessions
   */
  public getAllSessions(): GameSession[] {
    return this.sessionManager.getAllSessions();
  }
  
  /**
   * Get all active games for a specific host user
   */
  public async getActiveGamesForUser(userId: string): Promise<GameSession[]> {
    return this.sessionManager.getActiveGamesForUser(userId);
  }
  
  /**
   * Persist a game session to the database
   */
  public async persistGameSession(session: GameSession): Promise<boolean> {
    return this.sessionManager.persistGameSession(session);
  }
  
  // ======== PLAYER MANAGEMENT ========
  
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
    return this.playerManager.addPlayer(gameCode, playerId, playerName, playerAvatar, userId);
  }
  
  /**
   * Handle a player disconnecting
   */
  public async handlePlayerDisconnect(socketId: string): Promise<void> {
    return this.playerManager.handlePlayerDisconnect(socketId);
  }
  
  /**
   * Handle host reconnection to an existing game
   */
  public async handleHostReconnection(socketId: string, gameCode: string, hostUserId?: string): Promise<GameSession | null> {
    return this.playerManager.handleHostReconnection(socketId, gameCode, hostUserId);
  }
  
  // Voting-related methods removed
  
  // ======== GAME STATE MANAGEMENT ========
  
  /**
   * Start a game session
   */
  public async startGame(gameCode: string): Promise<boolean> {
    return this.gameStateManager.startGame(gameCode);
  }
  
  /**
   * Show the leaderboard
   */
  public async showLeaderboard(gameCode: string): Promise<boolean> {
    return this.gameStateManager.showLeaderboard(gameCode);
  }
  
  /**
   * End a game session
   */
  public async endGame(gameCode: string): Promise<GameResult | null> {
    return this.gameStateManager.endGame(gameCode);
  }
  
  // ======== QUESTION MANAGEMENT ========
  
  /**
   * Move to the next question in a game session
   */
  public async nextQuestion(gameCode: string): Promise<boolean> {
    console.log("-----------NEXT QUESTION-----------");
    return this.questionManager.nextQuestion(gameCode);
  }
  
  /**
   * Start timer for the current question without advancing to next question
   * Used when starting a game to activate the timer for the first question
   */
  public async startCurrentQuestionTimer(gameCode: string): Promise<boolean> {
    console.log("-----------START CURRENT QUESTION TIMER-----------");
    return this.questionManager.startCurrentQuestionTimer(gameCode);
  }
  
  /**
   * Record a player's answer to the current question
   */
  public async recordAnswer(gameCode: string, playerId: string, questionId: string, answer: string | string[], timeToAnswer?: number): Promise<boolean> {
    return this.questionManager.recordAnswer(gameCode, playerId, questionId, answer, timeToAnswer);
  }
  
  /**
   * Reveal the answer to the current question
   */
  public async revealAnswer(gameCode: string): Promise<QuestionResult | null> {
    return this.questionManager.revealAnswer(gameCode);
  }
  
  // ======== TIMER MANAGEMENT ========
  
  /**
   * Clear question timer for a game
   */
  public clearQuestionTimer(gameCode: string): void {
    this.timerManager.clearQuestionTimer(gameCode);
  }
}