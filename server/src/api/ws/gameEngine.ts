import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { 
  EVENTS, 
  CreateGameRequest, 
  JoinGameRequest, 
  GameSession, 
  Player, 
  QuestionResult, 
  GameResult,
  PlayerAnswer,
  generateRoomCode
} from 'shared';
import { getQuizById } from '../../db/quizzes';
import { 
  getGameSessionByCode, 
  saveGameSession, 
  deleteGameSession, 
  getGameSessionsByHostId 
} from '../../db/games';

// =========================================================================
// MANAGER CLASSES - These implement the game logic
// =========================================================================

/**
 * Manages question timers
 */
class TimerManager {
  private sessionManager: SessionManager;
  private io: SocketIOServer;
  private readonly DEFAULT_QUESTION_DURATION = 30 * 1000; // Default: 30 seconds per question
  private questionTimers: Map<string, { 
    interval: NodeJS.Timeout, 
    endTime: number,
    timerStarted: number 
  }> = new Map();

  constructor(sessionManager: SessionManager, io: SocketIOServer) {
    this.sessionManager = sessionManager;
    this.io = io;
  }

  /**
   * Broadcasts the remaining time to all clients in a game
   */
  public async broadcastRemainingTime(gameCode: string, endTime: number, questionId: string): Promise<void> {
    const session = this.sessionManager.getGameSessionSync(gameCode);
    if (!session) return;
    
    // Calculate the remaining time
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
    
    // Calculate total seconds from the timer information
    const timer = this.questionTimers.get(gameCode);
    const totalSeconds = timer ? Math.ceil((timer.endTime - timer.timerStarted) / 1000) : Math.ceil(this.DEFAULT_QUESTION_DURATION / 1000);
    
    this.io.to(gameCode).emit(EVENTS.TIMER_UPDATE, { 
      isTimed: true,
      remaining,
      questionId,
      totalSeconds
    });
    
    // If timer expired, clear the timer but let the host control game progression
    if (remaining <= 0) {
      this.clearQuestionTimer(gameCode);
      
      // Only notify if the game is still in question state
      if (session.status === 'question') {
        // Notify all clients about the timer expiration
        this.io.to(gameCode).emit(EVENTS.QUESTION_TIMER_END, { 
          gameCode,
          questionId
        });
        
        // Let the host know they should reveal the answer now
        const hostSocket = Array.from(this.io.sockets.sockets.values()).find(s => s.id === session.hostId);
        if (hostSocket) {
          hostSocket.emit(EVENTS.QUESTION_TIMER_END, { 
            gameCode,
            questionId,
            message: 'Time expired, reveal answer now'
          });
        }
      }
    }
  }
  
  /**
   * Helper to clear question timer
   */
  public clearQuestionTimer(gameCode: string): void {
    const timer = this.questionTimers.get(gameCode);
    if (timer) {
      clearInterval(timer.interval);
      this.questionTimers.delete(gameCode);
    }
  }
  
  /**
   * Start a timer for a question
   */
  public startQuestionTimer(gameCode: string, questionId: string, duration: number): void {
    const now = Date.now();
    const endTime = now + duration;
    
    // Send initial timer state to all clients
    this.broadcastRemainingTime(gameCode, endTime, questionId);
    
    // Set up interval to broadcast timer updates every second
    const interval = setInterval(() => {
      this.broadcastRemainingTime(gameCode, endTime, questionId);
    }, 1000);
    
    // Store the timer info for cleanup and debugging
    this.questionTimers.set(gameCode, { 
      interval, 
      endTime,
      timerStarted: now
    });
  }
  
  /**
   * Send untimed question notification
   */
  public sendUntimedNotification(gameCode: string, questionId: string): void {
    this.io.to(gameCode).emit(EVENTS.TIMER_UPDATE, { 
      isTimed: false,
      questionId
    });
  }
  
  /**
   * Get the default question duration
   */
  public getDefaultQuestionDuration(): number {
    return this.DEFAULT_QUESTION_DURATION;
  }
  
  /**
   * Get timer info for a game
   */
  public getTimerInfo(gameCode: string): { endTime: number, timerStarted: number } | null {
    const timer = this.questionTimers.get(gameCode);
    if (!timer) return null;
    
    return {
      endTime: timer.endTime,
      timerStarted: timer.timerStarted
    };
  }
}

/**
 * Manages questions and answers
 */
class QuestionManager {
  private sessionManager: SessionManager;
  private io: SocketIOServer;
  private timerManager: TimerManager;

  constructor(sessionManager: SessionManager, io: SocketIOServer, timerManager: TimerManager) {
    this.sessionManager = sessionManager;
    this.io = io;
    this.timerManager = timerManager;
  }
  
  /**
   * Start the timer for the current question without advancing to next question
   */
  public async startCurrentQuestionTimer(gameCode: string): Promise<boolean> {
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session || !session.currentQuizId) {
      return false;
    }
    
    try {
      // Clear any existing timer for this game
      this.timerManager.clearQuestionTimer(gameCode);
      
      // Get the quiz from the database
      const quizData = await getQuizById(session.currentQuizId);
      
      if (!quizData || !quizData.questions) {
        return false;
      }
      
      // Get the current question for this session
      const currentQuestion = quizData.questions[session.currentQuestionIndex];
      if (!currentQuestion) {
        return false;
      }
      
      // Make sure game is in question state
      session.status = 'question';
      session.lastActivityAt = new Date().toISOString(); // Update activity timestamp
      
      // Reset player answers for the question
      if (!session.playerAnswers) {
        session.playerAnswers = [];
      }
      
      // Determine if this is a timed quiz
      const isTimed = !!quizData.timeLimit;
      
      if (isTimed) {
        // Determine the question duration (from quiz timeLimit or default)
        let questionDuration = this.timerManager.getDefaultQuestionDuration(); // Default to 30 seconds
        
        // Use the quiz's global time limit
        if (quizData.timeLimit) {
          questionDuration = quizData.timeLimit * 1000; // Convert seconds to milliseconds
        }
        
        // Start the timer
        this.timerManager.startQuestionTimer(gameCode, currentQuestion.id, questionDuration);
      } else {
        // For untimed quizzes, send a special timer_update that indicates no timer
        this.timerManager.sendUntimedNotification(gameCode, currentQuestion.id);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Move to the next question in a game session
   */
  public async nextQuestion(gameCode: string): Promise<boolean> {
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session || !session.currentQuizId) {
      return false;
    }
    
    try {
      // Clear any existing timer for this game
      this.timerManager.clearQuestionTimer(gameCode);
      
      // Get the quiz from the database
      const quizData = await getQuizById(session.currentQuizId);
      
      if (!quizData || !quizData.questions) {
        return false;
      }
      
      // Check if we're at the end of the quiz
      if (session.currentQuestionIndex >= quizData.questions.length - 1) {
        session.status = 'finished';
        session.endedAt = new Date().toISOString();
        session.lastActivityAt = new Date().toISOString(); 
        return true;
      }
      
      // Increment the question index
      session.currentQuestionIndex++;
      session.status = 'question';
      session.lastActivityAt = new Date().toISOString();
      
      // Reset player answers for the new question
      if (!session.playerAnswers) {
        session.playerAnswers = [];
      }
      
      // Get the current question for this session
      const currentQuestion = quizData.questions[session.currentQuestionIndex];
      if (!currentQuestion) {
        return false;
      }
      
      // Determine if this is a timed quiz
      const isTimed = !!quizData.timeLimit;
      
      if (isTimed) {
        // Determine the question duration (from quiz timeLimit or default)
        let questionDuration = this.timerManager.getDefaultQuestionDuration(); // Default to 30 seconds
        
        // Use the quiz's global time limit
        if (quizData.timeLimit) {
          questionDuration = quizData.timeLimit * 1000; // Convert seconds to milliseconds
        }
        
        // Start the timer
        this.timerManager.startQuestionTimer(gameCode, currentQuestion.id, questionDuration);
      } else {
        // For untimed quizzes, send a special timer_update that indicates no timer
        this.timerManager.sendUntimedNotification(gameCode, currentQuestion.id);
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Record a player's answer to the current question
   */
  public async recordAnswer(gameCode: string, playerId: string, questionId: string, answer: string | string[], timeToAnswer?: number): Promise<boolean> {
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session || !session.currentQuizId) {
      return false;
    }
    
    // Make sure the game is in the question state
    if (session.status !== 'question') {
      return false;
    }
    
    // Find the player
    const playerIndex = session.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return false;
    }
    
    // Initialize playerAnswers if not exists
    if (!session.playerAnswers) {
      session.playerAnswers = [];
    }
    
    // Check if player already answered this question
    const existingAnswer = session.playerAnswers.findIndex(
      a => a.playerId === playerId && a.questionId === questionId
    );
    
    if (existingAnswer !== -1) {
      // Update existing answer
      session.playerAnswers[existingAnswer] = {
        playerId,
        questionId,
        answer,
        isCorrect: false, // Will be evaluated when answer is revealed
        timeToAnswer
      };
    } else {
      // Add new answer
      session.playerAnswers.push({
        playerId,
        questionId,
        answer,
        isCorrect: false, // Will be evaluated when answer is revealed
        timeToAnswer
      });
    }
    
    // Update session activity timestamp
    this.sessionManager.updateSessionActivity(gameCode);
    
    return true;
  }

  /**
   * Reveal the answer to the current question
   */
  public async revealAnswer(gameCode: string): Promise<QuestionResult | null> {
    // Clear any existing timer for this game
    this.timerManager.clearQuestionTimer(gameCode);
    
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session || !session.currentQuizId) {
      return null;
    }
    
    try {
      // Get the quiz from the database
      const quizData = await getQuizById(session.currentQuizId);
      
      if (!quizData || !quizData.questions || quizData.questions.length <= session.currentQuestionIndex) {
        return null;
      }
      
      // Get the current question
      const currentQuestion = quizData.questions[session.currentQuestionIndex];
      
      // Update the game status
      session.status = 'answer_reveal';
      session.lastActivityAt = new Date().toISOString();
      
      if (!session.playerAnswers) {
        session.playerAnswers = [];
      }
      
      // Evaluate player answers
      const questionAnswers: PlayerAnswer[] = session.playerAnswers
        .filter(answer => answer.questionId === currentQuestion.id)
        .map(answer => {
          // Determine if the answer is correct
          let isCorrect = false;
          
          if (Array.isArray(currentQuestion.correctAnswer)) {
            // Multiple answers (e.g., multi-select)
            if (Array.isArray(answer.answer)) {
              // Check if arrays match (order doesn't matter)
              const correctAnswerSet = new Set(currentQuestion.correctAnswer.map(a => a.toLowerCase()));
              const playerAnswerSet = new Set(answer.answer.map(a => a.toLowerCase()));
              
              isCorrect = correctAnswerSet.size === playerAnswerSet.size &&
                [...correctAnswerSet].every(value => playerAnswerSet.has(value));
            }
          } else {
            // Single answer
            if (typeof answer.answer === 'string') {
              isCorrect = answer.answer.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
            }
          }
          
          // Update player score if answer is correct
          if (isCorrect) {
            const playerIndex = session.players.findIndex(p => p.id === answer.playerId);
            if (playerIndex !== -1) {
              let pointsAwarded = 100; // Base points
              
              // Award bonus points for quick answers
              if (answer.timeToAnswer) {
                // Faster answers get more points (max bonus: 50 points)
                const timeBonus = Math.max(0, 50 - Math.floor(answer.timeToAnswer / 100));
                pointsAwarded += timeBonus;
              }
              
              session.players[playerIndex].score += pointsAwarded;
            }
          }
          
          // Update the answer with correctness
          return {
            ...answer,
            isCorrect
          };
        });
      
      // Create and return the question result
      const result: QuestionResult = {
        questionId: currentQuestion.id,
        playerAnswers: questionAnswers,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation
      };
      
      // Store the result in the session
      if (!session.questionResults) {
        session.questionResults = [];
      }
      session.questionResults.push(result);
      
      return result;
    } catch (error) {
      return null;
    }
  }
}

/**
 * Manages game state transitions
 */
class GameStateManager {
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
    
    // Make sure the game is in the lobby state
    if (session.status !== 'lobby') {
      return false;
    }
    
    // Set game to question state and update timestamps
    session.status = 'question';
    session.startedAt = new Date().toISOString();
    session.lastActivityAt = new Date().toISOString();
    
    // Start with question index 0
    session.currentQuestionIndex = 0;
    
    // Persist game session to DB if enabled
    if (this.sessionManager.dbPersistenceEnabled) {
      await this.sessionManager.persistGameSession(session);
    }
    
    return true;
  }

  /**
   * Show the leaderboard
   */
  public async showLeaderboard(gameCode: string): Promise<boolean> {
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      return false;
    }
    
    // Update game state to leaderboard
    session.status = 'leaderboard';
    session.lastActivityAt = new Date().toISOString();
    
    // Persist game session to DB if enabled
    if (this.sessionManager.dbPersistenceEnabled) {
      await this.sessionManager.persistGameSession(session);
    }
    
    return true;
  }

  /**
   * End a game session
   */
  public async endGame(gameCode: string): Promise<GameResult | null> {
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      return null;
    }
    
    // Update game state to finished
    session.status = 'finished';
    session.endedAt = new Date().toISOString();
    session.lastActivityAt = new Date().toISOString();
    
    // Calculate the final results
    const players = session.players;
    
    // Sort players by score in descending order
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    
    // Create the final game result
    const gameResult: GameResult = {
      gameCode,
      quizId: session.currentQuizId || '',
      leaderboard: sortedPlayers.map((player, index) => ({
        name: player.name,
        avatar: player.avatar,
        score: player.score,
        rank: index + 1,
        isHost: player.isHost
      }))
    };
    
    // Persist game session to DB if enabled
    if (this.sessionManager.dbPersistenceEnabled) {
      await this.sessionManager.persistGameSession(session);
    }
    
    return gameResult;
  }
}

/**
 * Manages player interactions including join, disconnect, and reconnect
 */
class PlayerManager {
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
    
    // Make sure game is still in lobby
    if (session.status !== 'lobby') {
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
      userId
    };
    
    // Add player to game session
    session.players.push(player);
    
    // Map socket ID to game code and player ID
    this.sessionManager.socketToPlayer.set(playerId, { gameCode, playerId });
    
    // Update session activity timestamp
    session.lastActivityAt = new Date().toISOString();
    
    // Persist game session to DB if enabled
    if (this.sessionManager.dbPersistenceEnabled) {
      await this.sessionManager.persistGameSession(session);
    }
    
    return player;
  }

  /**
   * Handle a player disconnecting
   */
  public async handlePlayerDisconnect(socketId: string): Promise<void> {
    const playerMapping = this.sessionManager.socketToPlayer.get(socketId);
    
    if (!playerMapping) {
      return;
    }
    
    const { gameCode, playerId } = playerMapping;
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      return;
    }
    
    // Find the player
    const playerIndex = session.players.findIndex(p => p.id === playerId);
    
    if (playerIndex !== -1) {
      const player = session.players[playerIndex];
      
      // If this is the host
      if (player.isHost) {
        // Mark host as disconnected
        player.isConnected = false;
        
        // Notify players that host disconnected
        this.io.to(gameCode).emit(EVENTS.HOST_DISCONNECTED, { 
          gameCode,
          message: 'Host has disconnected'
        });
      } else {
        // Mark player as disconnected
        player.isConnected = false;
        
        // Notify room that player disconnected
        this.io.to(gameCode).emit(EVENTS.PLAYER_LEFT, { 
          gameCode,
          playerId,
          playerName: player.name
        });
      }
      
      // If game is in lobby and all players disconnected, clean up the game
      const connectedPlayers = session.players.filter(p => p.isConnected);
      if (session.status === 'lobby' && connectedPlayers.length === 0) {
        // Clean up the session
        this.sessionManager.sessions.delete(gameCode);
        
        // No need to notify anyone since everyone is disconnected
        return;
      }
      
      // Update session activity timestamp
      session.lastActivityAt = new Date().toISOString();
      
      // Persist game session to DB if enabled
      if (this.sessionManager.dbPersistenceEnabled) {
        await this.sessionManager.persistGameSession(session);
      }
    }
    
    // Remove socket-to-player mapping
    this.sessionManager.socketToPlayer.delete(socketId);
  }

  /**
   * Handle host reconnection to an existing game
   */
  public async handleHostReconnection(socketId: string, gameCode: string, hostUserId?: string): Promise<GameSession | null> {
    const session = await this.sessionManager.getGameSession(gameCode);
    
    if (!session) {
      return null;
    }
    
    // For security, ensure the user is the host
    if (hostUserId && session.hostUserId && hostUserId !== session.hostUserId) {
      return null;
    }
    
    // Update host socket ID
    session.hostId = socketId;
    
    // Find the host player and update it
    const hostPlayerIndex = session.players.findIndex(p => p.isHost);
    
    if (hostPlayerIndex !== -1) {
      const hostPlayer = session.players[hostPlayerIndex];
      
      // Update the host player
      const oldHostId = hostPlayer.id;
      hostPlayer.id = socketId;
      hostPlayer.isConnected = true;
      
      // Update socket mappings
      this.sessionManager.socketToPlayer.delete(oldHostId);
      this.sessionManager.socketToPlayer.set(socketId, { gameCode, playerId: socketId });
      
      // Notify room that host reconnected
      this.io.to(gameCode).emit(EVENTS.HOST_RECONNECTED, { 
        gameCode,
        message: 'Host has reconnected'
      });
    }
    
    // Update session activity timestamp
    session.lastActivityAt = new Date().toISOString();
    
    // Persist game session to DB if enabled
    if (this.sessionManager.dbPersistenceEnabled) {
      await this.sessionManager.persistGameSession(session);
    }
    
    return session;
  }
}

/**
 * Core session management functionality
 */
class SessionManager {
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
    
    // Start the session persistence interval
    setInterval(() => this.persistAllSessions(), 60000); // Persist sessions every minute
  }
  
  /**
   * Persist all active game sessions to the database
   */
  private async persistAllSessions(): Promise<void> {
    if (!this.dbPersistenceEnabled) return;
    
    for (const [gameCode, session] of this.sessions.entries()) {
      try {
        await this.persistGameSession(session);
      } catch (error) {
        // Handle error
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
        return false;
      }
      
      return true;
    } catch (error) {
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
      return session;
    }
    
    // If not found in memory and DB persistence is enabled, try to load from DB
    if (this.dbPersistenceEnabled) {
      const dbSession = await this.loadGameSessionFromDB(code);
      
      if (dbSession) {
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
    
    return undefined;
  }
  
  /**
   * Get a game session synchronously (from memory only)
   * Used internally when async operation isn't possible
   */
  public getGameSessionSync(code: string): GameSession | undefined {
    return this.sessions.get(code);
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
        this.persistGameSession(session).catch(() => {});
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
        // Handle error
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
      return [];
    }
  }
  
  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date().getTime();
    
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
            // Handle error
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
      }
    }
  }
}

/**
 * Main GameSessionManager class that serves as the public API
 * Delegates to specialized managers for specific functionality
 */
class GameSessionManager {
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
    return this.questionManager.nextQuestion(gameCode);
  }
  
  /**
   * Start timer for the current question without advancing to next question
   * Used when starting a game to activate the timer for the first question
   */
  public async startCurrentQuestionTimer(gameCode: string): Promise<boolean> {
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

// =========================================================================
// SOCKET HANDLER - Entry point for socket communications
// =========================================================================

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
    // Handle disconnection
    socket.on(EVENTS.DISCONNECT, async () => {
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