// Socket.io Events
export const EVENTS = {
  // Connection Events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  
  // Game Session Events
  CREATE_GAME: 'create_game',
  JOIN_GAME: 'join_game',
  LEAVE_GAME: 'leave_game',
  START_GAME: 'start_game',
  END_GAME: 'end_game',
  GAME_CREATED: 'game_created',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  GAME_STARTED: 'game_started',
  GAME_ENDED: 'game_ended',
  
  // Quiz Events
  NEXT_QUESTION: 'next_question',
  SUBMIT_ANSWER: 'submit_answer',
  REVEAL_ANSWER: 'reveal_answer',
  QUESTION_TIMER_END: 'question_timer_end',
  SHOW_LEADERBOARD: 'show_leaderboard',
  
  // Game State Updates
  GAME_STATE_UPDATED: 'game_state_updated',
  PLAYER_ANSWERED: 'player_answered',
  ANSWER_REVEALED: 'answer_revealed',
  LEADERBOARD_UPDATED: 'leaderboard_updated',
  
  // Error Events
  ERROR: 'error'
};

// Game States
export const GAME_STATES = {
  LOBBY: 'lobby',
  QUESTION: 'question',
  ANSWER_REVEAL: 'answer_reveal',
  LEADERBOARD: 'leaderboard',
  FINISHED: 'finished'
};

// Quiz Types
export const QUIZ_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  FLASHCARDS: 'flashcards',
  TIMED: 'timed',
  FILL_IN_BLANK: 'fill_in_blank'
};

// Question Types
export const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  SHORT_ANSWER: 'short_answer',
  FILL_IN_BLANK: 'fill_in_blank'
};

// AI Services
export const AI_SERVICES = {
  OPENAI: 'openai',
  CLAUDE: 'claude'
};

// Error Codes
export const ERROR_CODES = {
  GAME_NOT_FOUND: 'game_not_found',
  GAME_ALREADY_STARTED: 'game_already_started',
  GAME_ALREADY_ENDED: 'game_already_ended',
  PLAYER_NAME_TAKEN: 'player_name_taken',
  INVALID_GAME_CODE: 'invalid_game_code',
  UNAUTHORIZED: 'unauthorized',
  INSUFFICIENT_CREDITS: 'insufficient_credits',
  INVALID_QUIZ_TYPE: 'invalid_quiz_type',
  INVALID_QUESTION_COUNT: 'invalid_question_count',
  INVALID_AI_SERVICE: 'invalid_ai_service',
  QUIZ_GENERATION_FAILED: 'quiz_generation_failed',
  PAYMENT_FAILED: 'payment_failed',
  DOCUMENT_PROCESSING_FAILED: 'document_processing_failed',
  INTERNAL_SERVER_ERROR: 'internal_server_error'
};

// Credit Packages
export const CREDIT_PACKAGES = {
  SMALL: {
    amount: 5,
    price: 4.99,
    discount: 0
  },
  MEDIUM: {
    amount: 15,
    price: 12.99,
    discount: 13
  },
  LARGE: {
    amount: 50,
    price: 39.99,
    discount: 20
  }
};

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  QUESTION_DEFAULT: 30000,
  ANSWER_REVEAL: 5000,
  LEADERBOARD: 10000,
  RECONNECT: 60000,
  LOBBY_INACTIVE: 1800000 // 30 minutes
};

// Avatar Options
export const AVATAR_OPTIONS = [
  '👨‍💻', '👩‍💻', '🧙‍♂️', '🧙‍♀️', '👨‍🚀', '👩‍🚀',
  '👨‍🔬', '👩‍🔬', '🦊', '🐱', '🐶', '🐼',
  '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
  '🦄', '🐰', '🐨', '🐻', '🐲', '🦖'
];
