import { Server as SocketIOServer } from 'socket.io';
import { QuestionResult, PlayerAnswer } from 'shared';
import { getQuizById } from '../../db/quizzes';
import { SessionManager } from './SessionManager';
import { TimerManager } from './TimerManager';

/**
 * Manages questions and answers
 */
export class QuestionManager {
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
        console.error(`Quiz data missing or invalid: ${session.currentQuizId}`);
        return false;
      }
      
      // Get the current question for this session
      const currentQuestion = quizData.questions[session.currentQuestionIndex];
      if (!currentQuestion) {
        console.error(`Question not found at index ${session.currentQuestionIndex}`);
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
        
        console.log(`Starting timer for current question in game ${gameCode}`);
        
        // Start the timer
        this.timerManager.startQuestionTimer(gameCode, currentQuestion.id, questionDuration);
      } else {
        // For untimed quizzes, send a special timer_update that indicates no timer
        this.timerManager.sendUntimedNotification(gameCode, currentQuestion.id);
      }
      
      return true;
    } catch (error) {
      console.error(`Error starting timer for current question:`, error);
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
        console.error(`Quiz data missing or invalid: ${session.currentQuizId}`);
        return false;
      }
      
      // Check if we're at the end of the quiz
      if (session.currentQuestionIndex >= quizData.questions.length - 1) {
        console.log(`Quiz ${session.currentQuizId} completed - showing final results`);
        session.status = 'finished';
        session.endedAt = new Date().toISOString();
        session.lastActivityAt = new Date().toISOString(); // Update activity timestamp
        return true;
      }
      
      // Increment the question index
      session.currentQuestionIndex++;
      session.status = 'question';
      session.lastActivityAt = new Date().toISOString(); // Update activity timestamp
      
      // Reset player answers for the new question
      if (!session.playerAnswers) {
        session.playerAnswers = [];
      }
      
      // Get the current question for this session
      const currentQuestion = quizData.questions[session.currentQuestionIndex];
      if (!currentQuestion) {
        console.error(`Question not found at index ${session.currentQuestionIndex}`);
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

        console.log("-----------HELLO-----------");
        
        // Start the timer
        this.timerManager.startQuestionTimer(gameCode, currentQuestion.id, questionDuration);
      } else {
        // For untimed quizzes, send a special timer_update that indicates no timer
        this.timerManager.sendUntimedNotification(gameCode, currentQuestion.id);
      }
      
      console.log(`Moving to question ${session.currentQuestionIndex} for game ${gameCode}`);
      return true;
    } catch (error) {
      console.error(`Error moving to next question:`, error);
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
        console.error(`Quiz data missing or invalid: ${session.currentQuizId}, question index: ${session.currentQuestionIndex}`);
        return null;
      }
      
      // Get the current question
      const currentQuestion = quizData.questions[session.currentQuestionIndex];
      
      // Update the game status
      session.status = 'answer_reveal';
      session.lastActivityAt = new Date().toISOString(); // Update activity timestamp
      
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
      console.error(`Error revealing answer:`, error);
      return null;
    }
  }
}