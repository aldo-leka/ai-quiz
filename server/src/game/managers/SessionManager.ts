import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameSession, Player, EVENTS, generateRoomCode } from 'shared';
import { getGameSessionByCode, saveGameSession, deleteGameSession, getGameSessionsByHostId } from '../../db/games';
import { PlayerManager } from './PlayerManager';
import { TimerManager } from './TimerManager';
import { QuestionManager } from './QuestionManager';
import { GameStateManager } from './GameStateManager';

/**
 * Core session management functionality
 */
export class SessionManager {
  public sessions: Map<string, GameSession> = new Map();
  public dbPersistenceEnabled: boolean = false; // true
  public socketToPlayer: Map<string, { gameCode: string, playerId: string }> = new Map();
  private io: SocketIOServer;
  private readonly SESSION_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
  private readonly SESSION_TIMEOUT = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  
  public timerManager: TimerManager;
  public playerManager: PlayerManager;
  public questionManager: QuestionManager;
  public gameStateManager: GameStateManager;

  constructor(io: SocketIOServer) {
    this.io = io;
    
    // Initialize sub-managers
    this.timerManager = new TimerManager(this, io);
    this.playerManager = new PlayerManager(this, io);
    this.questionManager = new QuestionManager(this, io, this.timerManager);
    this.gameStateManager = new GameStateManager(this, io, this.questionManager);
    
    // Start the periodic cleanup interval
    setInterval(() => this.cleanupInactiveSessions(), this.SESSION_CLEANUP_INTERVAL);
    console.log(`Session cleanup scheduled to run every ${this.SESSION_CLEANUP_INTERVAL / 60000} minutes`);
    
    // Start the session persistence interval
    setInterval(() => this.persistAllSessions(), 60000); // Persist sessions every minute
    console.log('Session persistence scheduled to run every minute');
  }
  
  /**
   * Persist all active game sessions to the database
   */
  private async persistAllSessions(): Promise<void> {
    if (!this.dbPersistenceEnabled) return;
    
    console.log(`Persisting ${this.sessions.size} active game sessions to the database...`);
    
    for (const [gameCode, session] of this.sessions.entries()) {
      try {
        await this.persistGameSession(session);
      } catch (error) {
        console.error(`Error persisting game session ${gameCode}:`, error);
      }
    }
  }
  
  /**
   * Persist a game session to the database
   */
  public async persistGameSession(session: GameSession): Promise<boolean> {
    if (!this.dbPersistenceEnabled) return true;
    
    try {
      const sessionId = await saveGameSession(session);
      if (!sessionId) {
        console.error(`Failed to persist game session ${session.code}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`Error persisting game session ${session.code}:`, error);
      return false;
    }
  }
  
  /**
   * Load a game session from the database by its code
   */
  private async loadGameSessionFromDB(gameCode: string): Promise<GameSession | null> {
    if (!this.dbPersistenceEnabled) return null;
    
    try {
      return await getGameSessionByCode(gameCode);
    } catch (error) {
      console.error(`Error loading game session ${gameCode} from DB:`, error);
      return null;
    }
  }
  
  /**
   * Create a new game session
   */
  public createGameSession(hostId: string, hostName: string, hostAvatar: string, quizId?: string, hostUserId?: string): GameSession {
    // Generate a unique 4-letter code that isn't already in use
    let roomCode: string;
    do {
      roomCode = generateRoomCode();
    } while (this.sessions.has(roomCode));
    
    // Create the host player
    const hostPlayer: Player = {
      id: hostId, // Socket ID
      name: hostName,
      avatar: hostAvatar,
      score: 0,
      isConnected: true,
      isHost: true,
      userId: hostUserId // Store the host's user ID if available
    };
    
    // Create the game session
    const gameSession: GameSession = {
      id: uuidv4(),
      code: roomCode,
      hostId: hostId, // Socket ID
      hostUserId: hostUserId, // User ID from database
      status: 'lobby',
      players: [hostPlayer],
      currentQuizId: quizId,
      currentQuestionIndex: 0,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };
    
    // Store the session
    this.sessions.set(roomCode, gameSession);
    this.socketToPlayer.set(hostId, { gameCode: roomCode, playerId: hostPlayer.id });
    
    return gameSession;
  }
  
  /**
   * Get a game session by its code
   */
  public async getGameSession(code: string): Promise<GameSession | undefined> {
    // First check in-memory cache
    let session = this.sessions.get(code);
    
    if (session) {
      console.log(`DEBUG getGameSession: Found session ${code} in memory with ${session.players.length} players`);
      return session;
    }
    
    // If not found in memory and DB persistence is enabled, try to load from DB
    if (this.dbPersistenceEnabled) {
      console.log(`DEBUG getGameSession: Attempting to load session ${code} from database`);
      const dbSession = await this.loadGameSessionFromDB(code);
      
      if (dbSession) {
        console.log(`DEBUG getGameSession: Loaded session ${code} from database with ${dbSession.players.length} players`);
        
        // Store in memory for future use
        this.sessions.set(code, dbSession);
        
        // Reconnect socket mappings
        dbSession.players.forEach(player => {
          if (player.id) {
            this.socketToPlayer.set(player.id, { gameCode: code, playerId: player.id });
          }
        });
        
        return dbSession;
      }
    }
    
    console.log(`DEBUG getGameSession: No session found for code ${code}`);
    return undefined;
  }
  
  /**
   * Get a game session synchronously (from memory only)
   * Used internally when async operation isn't possible
   */
  public getGameSessionSync(code: string): GameSession | undefined {
    const session = this.sessions.get(code);
    
    if (session) {
      // console.log(`DEBUG getGameSessionSync: Found session ${code} in memory with ${session.players.length} players`);
    } else {
      console.log(`DEBUG getGameSessionSync: No session found in memory for code ${code}`);
    }
    
    return session;
  }
  
  /**
   * Update the lastActivityAt timestamp for a session
   */
  public updateSessionActivity(gameCode: string): void {
    // Use direct access to sessions map to avoid async call
    const session = this.sessions.get(gameCode);
    if (session) {
      session.lastActivityAt = new Date().toISOString();
      
      // Schedule a db persistence in the background without waiting
      if (this.dbPersistenceEnabled) {
        this.persistGameSession(session).catch(error => {
          console.error(`Error persisting session activity for ${gameCode}:`, error);
        });
      }
    }
  }
  
  /**
   * Get all active game sessions
   */
  public getAllSessions(): GameSession[] {
    return Array.from(this.sessions.values());
  }
  
  /**
   * Get all active games for a specific host user
   * This includes games where the host has disconnected but the game is still active
   */
  public async getActiveGamesForUser(userId: string): Promise<GameSession[]> {
    if (!userId) return [];
    
    const activeSessions: GameSession[] = [];
    
    // First, check in-memory games
    for (const session of this.sessions.values()) {
      if (session.hostUserId === userId && session.status !== 'finished') {
        activeSessions.push(session);
      }
    }
    
    // If DB persistence is enabled, check the database for any other active games
    // this user might have created but aren't in memory anymore
    if (this.dbPersistenceEnabled) {
      try {
        const dbSessions = await this.fetchGameSessionsByHostId(userId);
        
        // Only add sessions that aren't already in our list
        for (const dbSession of dbSessions) {
          if (!activeSessions.some(s => s.id === dbSession.id)) {
            activeSessions.push(dbSession);
            
            // Add the session to our in-memory cache
            this.sessions.set(dbSession.code, dbSession);
          }
        }
      } catch (error) {
        console.error(`Error fetching active games for user ${userId}:`, error);
      }
    }
    
    return activeSessions;
  }
  
  /**
   * Get all game sessions created by a specific host from the database
   * @private
   */
  private async fetchGameSessionsByHostId(hostUserId: string): Promise<GameSession[]> {
    if (!this.dbPersistenceEnabled || !hostUserId) return [];
    
    try {
      // Use the imported function from games.ts database module
      return await getGameSessionsByHostId(hostUserId);
    } catch (error) {
      console.error(`Error getting game sessions for host ${hostUserId}:`, error);
      return [];
    }
  }
  
  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date().getTime();
    let sessionsRemoved = 0;
    
    for (const [code, session] of this.sessions.entries()) {
      // Skip sessions that don't have a lastActivityAt timestamp
      if (!session.lastActivityAt) continue;
      
      const lastActivityTime = new Date(session.lastActivityAt).getTime();
      const timeSinceLastActivity = now - lastActivityTime;
      
      // If session has been inactive for longer than the timeout, remove it
      if (timeSinceLastActivity > this.SESSION_TIMEOUT) {
        // Notify any connected players that the game is being ended due to inactivity
        if (session.status !== 'finished') {
          try {
            this.io.to(code).emit(EVENTS.ERROR, { 
              message: 'Game ended due to inactivity' 
            });
          } catch (error) {
            console.error(`Error notifying room ${code} of session expiration:`, error);
          }
        }
        
        // Clean up associated socket mappings
        for (const player of session.players) {
          // Remove the socket mapping for this player
          for (const [socketId, playerInfo] of this.socketToPlayer.entries()) {
            if (playerInfo.gameCode === code) {
              this.socketToPlayer.delete(socketId);
            }
          }
        }
        
        // Remove the session
        this.sessions.delete(code);
        sessionsRemoved++;
      }
    }
    
    if (sessionsRemoved > 0) {
      console.log(`Cleaned up ${sessionsRemoved} inactive game sessions`);
    }
  }
}