import { GameSession, Player, Quiz, QuizQuestion, Error } from './types';
import { ERROR_CODES } from './constants';

/**
 * Generates a random 4-letter room code
 */
export function generateRoomCode(): string {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

/**
 * Calculates player scores based on correctness and time to answer
 */
export function calculateScore(isCorrect: boolean, timeToAnswer: number, maxTime: number): number {
  if (!isCorrect) return 0;
  
  // Base score for correct answer
  const baseScore = 1000;
  
  // Bonus for answering quickly (up to 500 points)
  const timeBonus = Math.floor((1 - (timeToAnswer / maxTime)) * 500);
  
  return baseScore + Math.max(0, timeBonus);
}

/**
 * Creates a leaderboard sorted by player scores
 */
export function createLeaderboard(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.score - a.score);
}

/**
 * Validates if a player name is available in a game session
 */
export function isPlayerNameAvailable(name: string, gameSession: GameSession): boolean {
  return !gameSession.players.some(player => 
    player.name.toLowerCase() === name.toLowerCase());
}

/**
 * Creates an error object with the given code and optional details
 */
export function createError(code: keyof typeof ERROR_CODES, message?: string, details?: any): Error {
  return {
    code: ERROR_CODES[code],
    message: message || getDefaultErrorMessage(code),
    details
  };
}

/**
 * Gets the default error message for an error code
 */
function getDefaultErrorMessage(code: keyof typeof ERROR_CODES): string {
  switch (code) {
    case 'GAME_NOT_FOUND':
      return 'Game not found. It may have ended or the code is incorrect.';
    case 'GAME_ALREADY_STARTED':
      return 'This game has already started.';
    case 'GAME_ALREADY_ENDED':
      return 'This game has already ended.';
    case 'PLAYER_NAME_TAKEN':
      return 'This name is already taken in the game. Please choose another.';
    case 'INVALID_GAME_CODE':
      return 'Invalid game code. Please check and try again.';
    case 'UNAUTHORIZED':
      return 'You are not authorized to perform this action.';
    case 'INSUFFICIENT_CREDITS':
      return 'You do not have enough credits to create this quiz.';
    case 'INVALID_QUIZ_TYPE':
      return 'The selected quiz type is invalid.';
    case 'INVALID_QUESTION_COUNT':
      return 'The number of questions must be between 5 and 50.';
    case 'INVALID_AI_SERVICE':
      return 'The selected AI service is invalid or unavailable.';
    case 'QUIZ_GENERATION_FAILED':
      return 'Failed to generate quiz. Please try again later.';
    case 'PAYMENT_FAILED':
      return 'Payment failed to process. Please try again or contact support.';
    case 'DOCUMENT_PROCESSING_FAILED':
      return 'Failed to process the uploaded document. Please check format and try again.';
    case 'INTERNAL_SERVER_ERROR':
      return 'An unexpected error occurred. Please try again later.';
    default:
      return 'An error occurred.';
  }
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Validates a quiz object
 */
export function validateQuiz(quiz: Quiz): boolean {
  // Check basic quiz properties
  if (!quiz.title || !quiz.theme || !quiz.type || !quiz.questions || !Array.isArray(quiz.questions)) {
    return false;
  }
  
  // Check if questions array is not empty
  if (quiz.questions.length === 0) {
    return false;
  }
  
  // Validate each question
  for (const question of quiz.questions) {
    if (!validateQuestion(question)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Validates a quiz question object
 */
export function validateQuestion(question: QuizQuestion): boolean {
  // Check if question has text and type
  if (!question.text || !question.type) {
    return false;
  }
  
  // Check if question has correctAnswer
  if (question.correctAnswer === undefined) {
    return false;
  }
  
  // Validate based on question type
  switch (question.type) {
    case 'multiple_choice':
      return !!question.options && Array.isArray(question.options) && question.options.length >= 2;
    case 'true_false':
      return question.correctAnswer === 'true' || question.correctAnswer === 'false';
    case 'short_answer':
    case 'fill_in_blank':
      return true; // Just need the correctAnswer
    default:
      return false;
  }
}

/**
 * Truncates a string to a maximum length and adds ellipsis if needed
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Creates a slug from a string
 */
export function createSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') 
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
