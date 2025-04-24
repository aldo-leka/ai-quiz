export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  credits: number;
  created_at: string;
}

export interface Player {
  id: string;      // Socket ID (connection-specific)
  name: string;
  avatar: string;
  score: number;
  isConnected: boolean;
  isHost: boolean;
  userId?: string; // Database user ID (persistent)
}

export interface GameSession {
  id: string;
  code: string;
  hostId: string;              // Socket ID of host
  hostUserId?: string;         // Database user ID of host
  hostDisconnectedAt?: string; // Timestamp when host disconnected
  status: GameStatus;
  players: Player[];
  currentQuizId?: string;
  currentQuestionIndex: number;
  startedAt?: string;
  endedAt?: string;
  playerAnswers?: PlayerAnswer[];
  questionResults?: QuestionResult[];
  createdAt?: string;
  lastActivityAt?: string;
  nextGameOptions?: string[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  image_url?: string;
  // Flashcard-specific fields
  front?: string;
  back?: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  theme: string;
  type: QuizType;
  questions: QuizQuestion[];
  createdById: string;
  createdAt: string;
  imageUrl?: string;
  documentUrl?: string;
  timeLimit?: number; // Time limit in seconds for each question (default: 30)
}

export type GameStatus = 
  | 'lobby'
  | 'question'
  | 'answer_reveal'
  | 'leaderboard'
  | 'finished';

export type QuizType = 
  | 'multiple_choice'
  | 'true_false'
  | 'flashcards' 
  | 'fill_in_blank';

export type QuestionType = 
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'fill_in_blank'
  | 'flashcard';

export type AiService = 'openai' | 'claude';

export interface CreateGameRequest {
  hostName: string;
  hostAvatar: string;
  hostUserId?: string; // Optional user ID from auth system
  quizId?: string;
}

export interface JoinGameRequest {
  gameCode: string;
  playerName: string;
  playerAvatar: string;
  userId?: string; // Optional user ID for authentication
}

export interface CreateQuizRequest {
  theme: string;
  type: QuizType;
  questionCount: number;
  aiService: AiService;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  documentUrl?: string;
  timeLimit?: number; // Time limit in seconds for each question (default: 30)
}

export interface GenerateQuizThemesRequest {
  count: number;
  category?: string;
  audience?: 'kids' | 'teens' | 'adults' | 'mixed';
}

export interface QuizTheme {
  title: string;
  description: string;
  exampleQuestions: string[];
  audience: 'beginner' | 'intermediate' | 'advanced';
  imageUrl?: string;
}

export interface GenerateQuizThemesResponse {
  themes: QuizTheme[];
}

export interface PurchaseCreditsRequest {
  userId: string;
  amount: number;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
}

export interface PlayerAnswer {
  playerId: string;
  questionId: string;
  answer: string | string[];
  isCorrect: boolean;
  timeToAnswer?: number; // in milliseconds
}

export interface QuestionResult {
  questionId: string;
  playerAnswers: PlayerAnswer[];
  correctAnswer: string | string[];
  explanation?: string;
}

export interface GameResult {
  gameId?: string;
  gameCode?: string;
  quizId: string;
  players?: Player[];
  leaderboard?: any[];
  questionResults?: QuestionResult[];
  startedAt?: string;
  endedAt?: string;
}

export interface Error {
  code: string;
  message: string;
  details?: any;
}
