import { Server as SocketIOServer } from 'socket.io';
import { EVENTS } from 'shared';
import { SessionManager } from './SessionManager';

/**
 * Manages question timers
 */
export class TimerManager {
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
    // Use the sync version to avoid recursion/performance issues with timers
    const session = this.sessionManager.getGameSessionSync(gameCode);
    if (!session) return;
    
    // Calculate the remaining time
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
    
    // Send timer update to all clients in the game
    // console.log(`SERVER: Broadcasting timer_update: ${remaining}s for game ${gameCode}, question ${questionId}`);
    
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
      console.log(`Timer expired for game ${gameCode}, question ${questionId}`);
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
      } else {
        console.log(`Timer expired but game ${gameCode} is no longer in question state`);
      }
    }
  }
  
  /**
   * Helper to clear question timer
   */
  public clearQuestionTimer(gameCode: string): void {
    const timer = this.questionTimers.get(gameCode);
    if (timer) {
      console.log(`Clearing question timer for game ${gameCode}`);
      clearInterval(timer.interval);
      this.questionTimers.delete(gameCode);
    }
  }
  
  /**
   * Start a timer for a question
   */
  public startQuestionTimer(gameCode: string, questionId: string, duration: number): void {
    console.log(`---------------Starting timer for game ${gameCode}, question ${questionId}, duration: ${duration/1000}s`);
    const now = Date.now();
    const endTime = now + duration;
    
    // Send initial timer state to all clients
    this.broadcastRemainingTime(gameCode, endTime, questionId);
    
    // Set up interval to broadcast timer updates every second
    console.log(`Setting up server timer for game ${gameCode}, question ${questionId}, duration: ${duration/1000}s`);
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
    console.log(`Quiz question ${questionId} is untimed - no timer will be shown`);
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