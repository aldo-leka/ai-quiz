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
// SHARED STATE - Global variables that store the game state
// =========================================================================

// Main state stores
let io: SocketIOServer;
const sessions = new Map<string, GameSession>();
const socketToPlayer = new Map<string, { gameCode: string, playerId: string }>();
const questionTimers = new Map<string, { 
  interval: NodeJS.Timeout, 
  endTime: number,
  timerStarted: number 
}>();

// Configuration
const DEFAULT_QUESTION_DURATION = 30 * 1000; // 30 seconds
const SESSION_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
const SESSION_TIMEOUT = 3 * 60 * 60 * 1000; // 3 hours
let dbPersistenceEnabled = false;

// =========================================================================
// TIMER FUNCTIONS - Handle all question timing logic
// =========================================================================

/**
 * Clear a question timer for a game
 */
function clearQuestionTimer(gameCode: string): void {
  const timer = questionTimers.get(gameCode);
  if (timer) {
    clearInterval(timer.interval);
    questionTimers.delete(gameCode);
  }
}

/**
 * Broadcast remaining time to all clients in a game
 */
async function broadcastRemainingTime(gameCode: string, endTime: number, questionId: string): Promise<void> {
  const session = sessions.get(gameCode);
  if (!session) return;
  
  // Calculate the remaining time
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
  
  // Calculate total seconds
  const timer = questionTimers.get(gameCode);
  const totalSeconds = timer 
    ? Math.ceil((timer.endTime - timer.timerStarted) / 1000) 
    : Math.ceil(DEFAULT_QUESTION_DURATION / 1000);
  
  // Send timer update to all clients
  io.to(gameCode).emit(EVENTS.TIMER_UPDATE, { 
    isTimed: true,
    remaining,
    questionId,
    totalSeconds
  });
  
  // If timer expired, handle expiration
  if (remaining <= 0) {
    clearQuestionTimer(gameCode);
    
    // Only notify if still in question state
    if (session.status === 'question') {
      // Notify all clients
      io.to(gameCode).emit(EVENTS.QUESTION_TIMER_END, { 
        gameCode,
        questionId
      });
      
      // Let the host know specifically
      const hostSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.id === session.hostId);
        
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
 * Start a timer for a question
 */
function startQuestionTimer(gameCode: string, questionId: string, duration: number): void {
  const now = Date.now();
  const endTime = now + duration;
  
  // Send initial timer state
  broadcastRemainingTime(gameCode, endTime, questionId);
  
  // Set up interval for updates
  const interval = setInterval(() => {
    broadcastRemainingTime(gameCode, endTime, questionId);
  }, 1000);
  
  // Store timer info
  questionTimers.set(gameCode, { 
    interval, 
    endTime,
    timerStarted: now
  });
}

/**
 * Send notification for untimed questions
 */
function sendUntimedNotification(gameCode: string, questionId: string): void {
  io.to(gameCode).emit(EVENTS.TIMER_UPDATE, { 
    isTimed: false,
    questionId
  });
}

/**
 * Get timer info for a game
 */
function getTimerInfo(gameCode: string): { endTime: number, timerStarted: number } | null {
  const timer = questionTimers.get(gameCode);
  if (!timer) return null;
  
  return {
    endTime: timer.endTime,
    timerStarted: timer.timerStarted
  };
}

// =========================================================================
// SESSION FUNCTIONS - Handle game session management
// =========================================================================

/**
 * Persist a game session to the database
 */
async function persistGameSession(session: GameSession): Promise<boolean> {
  if (!dbPersistenceEnabled) return true;
  
  try {
    const sessionId = await saveGameSession(session);
    return !!sessionId;
  } catch (error) {
    return false;
  }
}

/**
 * Load a game session from the database
 */
async function loadGameSessionFromDB(gameCode: string): Promise<GameSession | null> {
  if (!dbPersistenceEnabled) return null;
  
  try {
    return await getGameSessionByCode(gameCode);
  } catch (error) {
    return null;
  }
}

/**
 * Create a new game session
 */
function createGameSession(
  hostId: string, 
  hostName: string, 
  hostAvatar: string, 
  quizId?: string, 
  hostUserId?: string
): GameSession {
  // Generate a unique code
  let roomCode: string;
  do {
    roomCode = generateRoomCode();
  } while (sessions.has(roomCode));
  
  // Create host player
  const hostPlayer: Player = {
    id: hostId,
    name: hostName,
    avatar: hostAvatar,
    score: 0,
    isConnected: true,
    isHost: true,
    userId: hostUserId
  };
  
  // Create game session
  const gameSession: GameSession = {
    id: uuidv4(),
    code: roomCode,
    hostId: hostId,
    hostUserId: hostUserId,
    status: 'lobby',
    players: [hostPlayer],
    currentQuizId: quizId,
    currentQuestionIndex: 0,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString()
  };
  
  // Store the session
  sessions.set(roomCode, gameSession);
  socketToPlayer.set(hostId, { gameCode: roomCode, playerId: hostPlayer.id });
  
  return gameSession;
}

/**
 * Get a game session by its code
 */
async function getGameSession(code: string): Promise<GameSession | undefined> {
  // First check memory
  let session = sessions.get(code);
  
  if (session) {
    return session;
  }
  
  // If not in memory, try database
  if (dbPersistenceEnabled) {
    const dbSession = await loadGameSessionFromDB(code);
    
    if (dbSession) {
      // Store in memory
      sessions.set(code, dbSession);
      
      // Reconnect socket mappings
      dbSession.players.forEach(player => {
        if (player.id) {
          socketToPlayer.set(player.id, { gameCode: code, playerId: player.id });
        }
      });
      
      return dbSession;
    }
  }
  
  return undefined;
}

/**
 * Update session activity timestamp
 */
function updateSessionActivity(gameCode: string): void {
  const session = sessions.get(gameCode);
  if (session) {
    session.lastActivityAt = new Date().toISOString();
    
    // Background persistence
    if (dbPersistenceEnabled) {
      persistGameSession(session).catch(() => {});
    }
  }
}

/**
 * Get all active sessions
 */
function getAllSessions(): GameSession[] {
  return Array.from(sessions.values());
}

/**
 * Get active games for a user
 */
async function getActiveGamesForUser(userId: string): Promise<GameSession[]> {
  if (!userId) return [];
  
  const activeSessions: GameSession[] = [];
  
  // Check in-memory games
  for (const session of sessions.values()) {
    if (session.hostUserId === userId && session.status !== 'finished') {
      activeSessions.push(session);
    }
  }
  
  // If DB enabled, check database too
  if (dbPersistenceEnabled) {
    try {
      const dbSessions = await getGameSessionsByHostId(userId);
      
      // Add only sessions not already in list
      for (const dbSession of dbSessions) {
        if (!activeSessions.some(s => s.id === dbSession.id)) {
          activeSessions.push(dbSession);
          sessions.set(dbSession.code, dbSession);
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  return activeSessions;
}

/**
 * Clean up inactive sessions
 */
function cleanupInactiveSessions(): void {
  const now = new Date().getTime();
  
  for (const [code, session] of sessions.entries()) {
    if (!session.lastActivityAt) continue;
    
    const lastActivityTime = new Date(session.lastActivityAt).getTime();
    const timeSinceLastActivity = now - lastActivityTime;
    
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      // Notify connected players if game not finished
      if (session.status !== 'finished') {
        try {
          io.to(code).emit(EVENTS.ERROR, { 
            message: 'Game ended due to inactivity' 
          });
        } catch (error) {
          // Ignore errors
        }
      }
      
      // Clean up socket mappings
      for (const player of session.players) {
        for (const [socketId, playerInfo] of socketToPlayer.entries()) {
          if (playerInfo.gameCode === code) {
            socketToPlayer.delete(socketId);
          }
        }
      }
      
      // Remove the session
      sessions.delete(code);
    }
  }
}

/**
 * Periodically persist all sessions
 */
function persistAllSessions(): void {
  if (!dbPersistenceEnabled) return;
  
  for (const session of sessions.values()) {
    persistGameSession(session).catch(() => {});
  }
}

// =========================================================================
// PLAYER FUNCTIONS - Handle players joining, disconnecting, reconnecting
// =========================================================================

/**
 * Add a player to a game
 */
async function addPlayer(
  gameCode: string, 
  playerId: string, 
  playerName: string, 
  playerAvatar: string,
  userId?: string
): Promise<Player | null> {
  const session = await getGameSession(gameCode);
  
  if (!session) {
    return null;
  }
  
  // Make sure game is in lobby
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
  
  // Add to game session
  session.players.push(player);
  
  // Map socket to player
  socketToPlayer.set(playerId, { gameCode, playerId });
  
  // Update activity timestamp
  updateSessionActivity(gameCode);
  
  // Persist if enabled
  if (dbPersistenceEnabled) {
    await persistGameSession(session);
  }
  
  return player;
}

/**
 * Handle player disconnection
 */
async function handlePlayerDisconnect(socketId: string): Promise<void> {
  const playerMapping = socketToPlayer.get(socketId);
  
  if (!playerMapping) {
    return;
  }
  
  const { gameCode, playerId } = playerMapping;
  const session = await getGameSession(gameCode);
  
  if (!session) {
    return;
  }
  
  // Find the player
  const playerIndex = session.players.findIndex(p => p.id === playerId);
  
  if (playerIndex !== -1) {
    const player = session.players[playerIndex];
    
    // Handle host vs regular player
    if (player.isHost) {
      // Mark host as disconnected
      player.isConnected = false;
      
      // Notify players
      io.to(gameCode).emit(EVENTS.HOST_DISCONNECTED, { 
        gameCode,
        message: 'Host has disconnected'
      });
    } else {
      // Mark player as disconnected
      player.isConnected = false;
      
      // Notify room
      io.to(gameCode).emit(EVENTS.PLAYER_LEFT, { 
        gameCode,
        playerId,
        playerName: player.name
      });
    }
    
    // Check if all players disconnected from a lobby
    const connectedPlayers = session.players.filter(p => p.isConnected);
    if (session.status === 'lobby' && connectedPlayers.length === 0) {
      // Clean up the session
      sessions.delete(gameCode);
      return;
    }
    
    // Update activity timestamp
    updateSessionActivity(gameCode);
    
    // Persist if enabled
    if (dbPersistenceEnabled) {
      await persistGameSession(session);
    }
  }
  
  // Remove socket mapping
  socketToPlayer.delete(socketId);
}

/**
 * Handle host reconnection
 */
async function handleHostReconnection(socketId: string, gameCode: string, hostUserId?: string): Promise<GameSession | null> {
  const session = await getGameSession(gameCode);
  
  if (!session) {
    return null;
  }
  
  // Security check
  if (hostUserId && session.hostUserId && hostUserId !== session.hostUserId) {
    return null;
  }
  
  // Update host socket ID
  session.hostId = socketId;
  
  // Find and update host player
  const hostPlayerIndex = session.players.findIndex(p => p.isHost);
  
  if (hostPlayerIndex !== -1) {
    const hostPlayer = session.players[hostPlayerIndex];
    
    // Update host player
    const oldHostId = hostPlayer.id;
    hostPlayer.id = socketId;
    hostPlayer.isConnected = true;
    
    // Update socket mappings
    socketToPlayer.delete(oldHostId);
    socketToPlayer.set(socketId, { gameCode, playerId: socketId });
    
    // Notify room
    io.to(gameCode).emit(EVENTS.HOST_RECONNECTED, { 
      gameCode,
      message: 'Host has reconnected'
    });
  }
  
  // Update activity timestamp
  updateSessionActivity(gameCode);
  
  // Persist if enabled
  if (dbPersistenceEnabled) {
    await persistGameSession(session);
  }
  
  return session;
}

// =========================================================================
// QUESTION FUNCTIONS - Handle question navigation and answers
// =========================================================================

/**
 * Start timer for current question without advancing
 */
async function startCurrentQuestionTimer(gameCode: string): Promise<boolean> {
  const session = await getGameSession(gameCode);
  
  if (!session || !session.currentQuizId) {
    return false;
  }
  
  try {
    // Clear any existing timer
    clearQuestionTimer(gameCode);
    
    // Get quiz data
    const quizData = await getQuizById(session.currentQuizId);
    
    if (!quizData || !quizData.questions) {
      return false;
    }
    
    // Get current question
    const currentQuestion = quizData.questions[session.currentQuestionIndex];
    if (!currentQuestion) {
      return false;
    }
    
    // Set game to question state
    session.status = 'question';
    session.lastActivityAt = new Date().toISOString();
    
    // Initialize player answers
    if (!session.playerAnswers) {
      session.playerAnswers = [];
    }
    
    // Check if timed quiz
    const isTimed = !!quizData.timeLimit;
    
    if (isTimed) {
      // Calculate duration
      let questionDuration = DEFAULT_QUESTION_DURATION;
      
      if (quizData.timeLimit) {
        questionDuration = quizData.timeLimit * 1000;
      }
      
      // Start the timer
      startQuestionTimer(gameCode, currentQuestion.id, questionDuration);
    } else {
      // Untimed quiz
      sendUntimedNotification(gameCode, currentQuestion.id);
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Move to the next question
 */
async function nextQuestion(gameCode: string): Promise<boolean> {
  const session = await getGameSession(gameCode);
  
  if (!session || !session.currentQuizId) {
    return false;
  }
  
  try {
    // Clear any existing timer
    clearQuestionTimer(gameCode);
    
    // Get quiz data
    const quizData = await getQuizById(session.currentQuizId);
    
    if (!quizData || !quizData.questions) {
      return false;
    }
    
    // Check if at quiz end
    if (session.currentQuestionIndex >= quizData.questions.length - 1) {
      session.status = 'finished';
      session.endedAt = new Date().toISOString();
      session.lastActivityAt = new Date().toISOString();
      return true;
    }
    
    // Increment question index
    session.currentQuestionIndex++;
    session.status = 'question';
    session.lastActivityAt = new Date().toISOString();
    
    // Reset player answers
    if (!session.playerAnswers) {
      session.playerAnswers = [];
    }
    
    // Get current question
    const currentQuestion = quizData.questions[session.currentQuestionIndex];
    if (!currentQuestion) {
      return false;
    }
    
    // Check if timed quiz
    const isTimed = !!quizData.timeLimit;
    
    if (isTimed) {
      // Calculate duration
      let questionDuration = DEFAULT_QUESTION_DURATION;
      
      if (quizData.timeLimit) {
        questionDuration = quizData.timeLimit * 1000;
      }
      
      // Start the timer
      startQuestionTimer(gameCode, currentQuestion.id, questionDuration);
    } else {
      // Untimed quiz
      sendUntimedNotification(gameCode, currentQuestion.id);
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Record a player's answer
 */
async function recordAnswer(
  gameCode: string, 
  playerId: string, 
  questionId: string, 
  answer: string | string[], 
  timeToAnswer?: number
): Promise<boolean> {
  const session = await getGameSession(gameCode);
  
  if (!session || !session.currentQuizId) {
    return false;
  }
  
  // Must be in question state
  if (session.status !== 'question') {
    return false;
  }
  
  // Find player
  const playerIndex = session.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return false;
  }
  
  // Initialize answers array if needed
  if (!session.playerAnswers) {
    session.playerAnswers = [];
  }
  
  // Check for existing answer
  const existingAnswer = session.playerAnswers.findIndex(
    a => a.playerId === playerId && a.questionId === questionId
  );
  
  if (existingAnswer !== -1) {
    // Update existing answer
    session.playerAnswers[existingAnswer] = {
      playerId,
      questionId,
      answer,
      isCorrect: false,
      timeToAnswer
    };
  } else {
    // Add new answer
    session.playerAnswers.push({
      playerId,
      questionId,
      answer,
      isCorrect: false,
      timeToAnswer
    });
  }
  
  // Update activity
  updateSessionActivity(gameCode);
  
  return true;
}

/**
 * Reveal the answer to the current question
 */
async function revealAnswer(gameCode: string): Promise<QuestionResult | null> {
  // Clear any timer
  clearQuestionTimer(gameCode);
  
  const session = await getGameSession(gameCode);
  
  if (!session || !session.currentQuizId) {
    return null;
  }
  
  try {
    // Get quiz data
    const quizData = await getQuizById(session.currentQuizId);
    
    if (!quizData || !quizData.questions || quizData.questions.length <= session.currentQuestionIndex) {
      return null;
    }
    
    // Get current question
    const currentQuestion = quizData.questions[session.currentQuestionIndex];
    
    // Update game status
    session.status = 'answer_reveal';
    session.lastActivityAt = new Date().toISOString();
    
    // Initialize answers array if needed
    if (!session.playerAnswers) {
      session.playerAnswers = [];
    }
    
    // Evaluate player answers
    const questionAnswers: PlayerAnswer[] = session.playerAnswers
      .filter(answer => answer.questionId === currentQuestion.id)
      .map(answer => {
        // Check correctness
        let isCorrect = false;
        
        if (Array.isArray(currentQuestion.correctAnswer)) {
          // Multiple answers
          if (Array.isArray(answer.answer)) {
            // Compare arrays
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
        
        // Update score if correct
        if (isCorrect) {
          const playerIndex = session.players.findIndex(p => p.id === answer.playerId);
          if (playerIndex !== -1) {
            let pointsAwarded = 100; // Base points
            
            // Add time bonus
            if (answer.timeToAnswer) {
              const timeBonus = Math.max(0, 50 - Math.floor(answer.timeToAnswer / 100));
              pointsAwarded += timeBonus;
            }
            
            session.players[playerIndex].score += pointsAwarded;
          }
        }
        
        // Return answer with correctness
        return {
          ...answer,
          isCorrect
        };
      });
    
    // Create result
    const result: QuestionResult = {
      questionId: currentQuestion.id,
      playerAnswers: questionAnswers,
      correctAnswer: currentQuestion.correctAnswer,
      explanation: currentQuestion.explanation
    };
    
    // Store result
    if (!session.questionResults) {
      session.questionResults = [];
    }
    session.questionResults.push(result);
    
    return result;
  } catch (error) {
    return null;
  }
}

// =========================================================================
// GAME STATE FUNCTIONS - Handle game state transitions
// =========================================================================

/**
 * Start a game
 */
async function startGame(gameCode: string): Promise<boolean> {
  const session = await getGameSession(gameCode);
  
  if (!session) {
    return false;
  }
  
  // Must be in lobby
  if (session.status !== 'lobby') {
    return false;
  }
  
  // Update game state
  session.status = 'question';
  session.startedAt = new Date().toISOString();
  session.lastActivityAt = new Date().toISOString();
  
  // Start at first question
  session.currentQuestionIndex = 0;
  
  // Persist if enabled
  if (dbPersistenceEnabled) {
    await persistGameSession(session);
  }
  
  return true;
}

/**
 * Show the leaderboard
 */
async function showLeaderboard(gameCode: string): Promise<boolean> {
  const session = await getGameSession(gameCode);
  
  if (!session) {
    return false;
  }
  
  // Update state
  session.status = 'leaderboard';
  session.lastActivityAt = new Date().toISOString();
  
  // Persist if enabled
  if (dbPersistenceEnabled) {
    await persistGameSession(session);
  }
  
  return true;
}

/**
 * End a game
 */
async function endGame(gameCode: string): Promise<GameResult | null> {
  const session = await getGameSession(gameCode);
  
  if (!session) {
    return null;
  }
  
  // Update state
  session.status = 'finished';
  session.endedAt = new Date().toISOString();
  session.lastActivityAt = new Date().toISOString();
  
  // Sort players by score
  const sortedPlayers = [...session.players].sort((a, b) => b.score - a.score);
  
  // Create result
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
  
  // Persist if enabled
  if (dbPersistenceEnabled) {
    await persistGameSession(session);
  }
  
  return gameResult;
}

// =========================================================================
// SOCKET HANDLERS - Entry point for socket communications
// =========================================================================

/**
 * Initialize the game engine
 */
export function initGameEngine(socketIo: SocketIOServer) {
  // Store io reference
  io = socketIo;
  
  // Start maintenance intervals
  setInterval(cleanupInactiveSessions, SESSION_CLEANUP_INTERVAL);
  setInterval(persistAllSessions, 60000);
  
  return {
    // Expose functions for external access if needed
    getGameSession,
    getAllSessions,
    getActiveGamesForUser,
    persistGameSession,
    
    // Configuration access
    get dbPersistenceEnabled() { return dbPersistenceEnabled; },
    set dbPersistenceEnabled(value: boolean) { dbPersistenceEnabled = value; },
    
    // State access
    get sessions() { return sessions; },
    get socketToPlayer() { return socketToPlayer; }
  };
}

/**
 * Setup socket handlers for the game
 */
export function setupSocketHandlers(socketIo: SocketIOServer) {
  // Initialize game engine
  const gameEngine = initGameEngine(socketIo);
  
  // Connection event
  io.on(EVENTS.CONNECT, (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);
    // Handle disconnection
    socket.on(EVENTS.DISCONNECT, async () => {
      await handlePlayerDisconnect(socket.id);
    });

    // GAME MANAGEMENT EVENTS
    
    // Create a new game
    socket.on(EVENTS.CREATE_GAME, (data: CreateGameRequest) => {
      const { hostName, hostAvatar, hostUserId, quizId } = data;

      console.log(`Creating game with hostId: ${socket.id}`);
      
      // Create game session
      const gameSession = createGameSession(
        socket.id,
        hostName,
        hostAvatar,
        quizId,
        hostUserId
      );
      
      // Join room
      socket.join(gameSession.code);
      
      // Emit event
      socket.emit(EVENTS.GAME_CREATED, { 
        roomCode: gameSession.code,
        gameSession
      });
    });
    
    // Join a game
    socket.on(EVENTS.JOIN_GAME, async (data: JoinGameRequest) => {
      const { gameCode, playerName, playerAvatar, userId } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      // Basic validation
      if (!gameSession) {
        socket.emit(EVENTS.ERROR, { message: 'Game not found' });
        return;
      }
      
      if (gameSession.status !== 'lobby') {
        socket.emit(EVENTS.ERROR, { message: 'Game has already started' });
        return;
      }
      
      if (userId && gameSession.hostUserId === userId) {
        socket.emit(EVENTS.ERROR, { 
          message: 'You are the host of this game. Use the "Resume Hosting" option instead.',
          code: 'HOST_ATTEMPT_JOIN_AS_PLAYER'
        });
        return;
      }
      
      if (gameSession.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
        socket.emit(EVENTS.ERROR, { message: 'Player name is already taken' });
        return;
      }
      
      // Add player
      const player = await addPlayer(gameCode, socket.id, playerName, playerAvatar, userId);
      
      if (!player) {
        socket.emit(EVENTS.ERROR, { message: 'Failed to join game' });
        return;
      }
      
      // Join room
      socket.join(gameCode);
      
      // Emit events
      io.to(gameCode).emit(EVENTS.PLAYER_JOINED, { player });
      
      const updatedGameSession = await getGameSession(gameCode);
      if (updatedGameSession) {
        socket.emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
      }
    });
    
    // Start a game
    socket.on(EVENTS.START_GAME, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      // Basic validation
      if (!gameSession) {
        socket.emit(EVENTS.ERROR, { message: 'Game not found' });
        return;
      }
      
      if (gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Only the host can start the game' });
        return;
      }
      
      // Start game
      const success = await startGame(gameCode);
      
      if (!success) {
        socket.emit(EVENTS.ERROR, { message: 'Failed to start game' });
        return;
      }
      
      // Get updated session
      const updatedGameSession = await getGameSession(gameCode);
      
      if (!updatedGameSession) {
        socket.emit(EVENTS.ERROR, { message: 'Game session not found' });
        return;
      }
      
      // Emit events
      io.to(gameCode).emit(EVENTS.GAME_STARTED, { gameCode });
      io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
      
      // Start timer for first question
      await startCurrentQuestionTimer(gameCode);
    });
    
    // QUIZ NAVIGATION EVENTS
    
    // Next question
    socket.on(EVENTS.NEXT_QUESTION, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      // Validate host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // Go to next question
      const success = await nextQuestion(gameCode);
      
      if (success) {
        // Get updated session
        const updatedGameSession = await getGameSession(gameCode);
        
        if (updatedGameSession) {
          // Emit update
          io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
        }
      }
    });
    
    // Submit answer
    socket.on(EVENTS.SUBMIT_ANSWER, async (data: { gameCode: string, questionId: string, answer: string | string[] }) => {
      const { gameCode, questionId, answer } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      // Basic validation
      if (!gameSession) {
        socket.emit(EVENTS.ERROR, { message: 'Game not found' });
        return;
      }
      
      // Find player
      const playerId = socket.id;
      const player = gameSession.players.find(p => p.id === playerId);
      
      if (!player) {
        socket.emit(EVENTS.ERROR, { message: 'Player not found' });
        return;
      }
      
      // Calculate time to answer
      const timer = getTimerInfo(gameCode);
      let timeToAnswer: number | undefined;
      
      if (timer) {
        timeToAnswer = Date.now() - timer.timerStarted;
      }
      
      // Record answer
      const success = await recordAnswer(gameCode, playerId, questionId, answer, timeToAnswer);
      
      if (success) {
        // Notify players
        io.to(gameCode).emit(EVENTS.PLAYER_ANSWERED, { 
          playerId,
          answer,
          playerName: player.name
        });
        
        // Check if all answered
        const allPlayers = gameSession.players;
        const currentAnswers = gameSession.playerAnswers || [];
        const answeredPlayers = new Set(currentAnswers.map(a => a.playerId));
        
        const allPlayersAnswered = allPlayers.every(p => answeredPlayers.has(p.id));
        
        if (allPlayersAnswered) {
          io.to(gameCode).emit(EVENTS.ALL_PLAYERS_ANSWERED);
        }
      }
    });
    
    // Reveal answer
    socket.on(EVENTS.REVEAL_ANSWER, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      // Validate host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // Reveal answer
      const result = await revealAnswer(gameCode);
      
      if (result) {
        // Get updated session
        const updatedGameSession = await getGameSession(gameCode);
        
        if (updatedGameSession) {
          // Emit events
          io.to(gameCode).emit(EVENTS.ANSWER_REVEALED, result);
          io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
        }
      }
    });
    
    // Show leaderboard
    socket.on(EVENTS.SHOW_LEADERBOARD, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      // Validate host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // Show leaderboard
      const success = await showLeaderboard(gameCode);
      
      if (success) {
        // Get updated session
        const updatedGameSession = await getGameSession(gameCode);
        
        if (updatedGameSession) {
          // Emit events
          io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
          io.to(gameCode).emit(EVENTS.LEADERBOARD_UPDATED);
        }
      }
    });
    
    // End game
    socket.on(EVENTS.END_GAME, async (data: { gameCode: string }) => {
      const { gameCode } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      // Validate host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // End game
      const result = await endGame(gameCode);
      
      if (result) {
        // Get updated session
        const updatedGameSession = await getGameSession(gameCode);
        
        if (updatedGameSession) {
          // Emit events
          io.to(gameCode).emit(EVENTS.GAME_ENDED, result);
          io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
        }
      }
    });
    
    // RECONNECTION EVENTS
    
    // Host reconnection
    socket.on('join_host_room', async (data: { gameCode: string, hostUserId?: string }) => {
      const { gameCode, hostUserId } = data;
      
      // Handle reconnection
      const gameSession = await handleHostReconnection(socket.id, gameCode, hostUserId);
      
      if (gameSession) {
        // Join room
        socket.join(gameCode);
        
        // Send state
        socket.emit(EVENTS.GAME_STATE_UPDATED, gameSession);
      } else {
        socket.emit(EVENTS.ERROR, { message: 'Game not found or you are not the host' });
      }
    });
    
    // Player reconnection
    socket.on('reconnect_player', async (data: { gameCode: string, playerName: string, playerAvatar: string }) => {
      const { gameCode, playerName, playerAvatar } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      if (!gameSession) {
        socket.emit(EVENTS.ERROR, { message: 'Game not found' });
        return;
      }
      
      // Find player
      const existingPlayer = gameSession.players.find(p => 
        p.name.toLowerCase() === playerName.toLowerCase() && !p.isHost
      );
      
      if (existingPlayer) {
        // Update player connection
        const oldPlayerId = existingPlayer.id;
        existingPlayer.id = socket.id;
        existingPlayer.isConnected = true;
        
        // Update mappings
        socketToPlayer.delete(oldPlayerId);
        socketToPlayer.set(socket.id, { gameCode, playerId: socket.id });
        
        // Update session
        sessions.set(gameCode, gameSession);
        
        // Join room
        socket.join(gameCode);
        
        // Send game state
        socket.emit(EVENTS.GAME_STATE_UPDATED, gameSession);
        
        // Notify other players
        io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, gameSession);
        socket.to(gameCode).emit(EVENTS.PLAYER_JOINED, { player: existingPlayer });
      } else {
        // Treat as new join
        await addPlayer(gameCode, socket.id, playerName, playerAvatar);
        
        // Join room
        socket.join(gameCode);
        
        // Get updated session
        const updatedGameSession = await getGameSession(gameCode);
        
        if (updatedGameSession) {
          socket.emit(EVENTS.GAME_STATE_UPDATED, updatedGameSession);
        }
      }
    });
    
    // Start new game after finishing
    socket.on('start_new_game', async (data: { gameCode: string, gameType: string }) => {
      const { gameCode, gameType } = data;
      
      // Get session
      const gameSession = await getGameSession(gameCode);
      
      // Validate host
      if (!gameSession || gameSession.hostId !== socket.id) {
        socket.emit(EVENTS.ERROR, { message: 'Unauthorized' });
        return;
      }
      
      // Notify about game type
      io.to(gameCode).emit('next_game_selected', { nextGameType: gameType });
      
      // Reset session
      gameSession.status = 'lobby';
      gameSession.currentQuestionIndex = 0;
      gameSession.playerAnswers = [];
      gameSession.questionResults = [];
      gameSession.startedAt = null;
      gameSession.endedAt = null;
      gameSession.lastActivityAt = new Date().toISOString();
      
      // Handle quiz ID based on type
      if (gameType !== 'same_quiz' && gameType !== 'new_quiz_same_theme') {
        gameSession.currentQuizId = null;
      }
      
      // Reset scores
      gameSession.players.forEach(player => {
        player.score = 0;
      });
      
      // Update session
      sessions.set(gameCode, gameSession);
      
      // Persist if enabled
      if (dbPersistenceEnabled) {
        await persistGameSession(gameSession);
      }
      
      // Notify clients
      io.to(gameCode).emit(EVENTS.GAME_STATE_UPDATED, gameSession);
    });
  });
  
  return gameEngine;
}