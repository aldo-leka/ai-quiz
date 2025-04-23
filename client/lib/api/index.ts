import axios from 'axios';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Quiz, CreateQuizRequest, StripeCheckoutSession } from 'shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor to include the token in requests
api.interceptors.request.use(async (config) => {
  const supabase = createClientComponentClient();
  const { data } = await supabase.auth.getSession();
  
  if (data.session?.access_token) {
    config.headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  
  return config;
});

// Quiz API functions
export async function fetchQuizzes(): Promise<Quiz[]> {
  try {
    const response = await api.get('/api/quiz');
    return response.data;
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    return [];
  }
}

export async function fetchQuizById(quizId: string, gameCode?: string): Promise<Quiz | null> {
  try {
    // If gameCode is provided, fetch the quiz without auth (for players in a game)
    if (gameCode) {
      const response = await axios.get(`${API_URL}/api/games/${gameCode}/quiz/${quizId}`);
      return response.data;
    } else {
      // Regular authenticated quiz fetch (for hosts/quiz creators)
      const response = await api.get(`/api/quiz/${quizId}`);
      return response.data;
    }
  } catch (error) {
    console.error(`Error fetching quiz ${quizId}:`, error);
    return null;
  }
}

export async function generateQuiz(data: CreateQuizRequest): Promise<Quiz | null> {
  try {
    const response = await api.post('/api/quiz/generate', data);
    return response.data;
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw error;
  }
}

export async function generateQuizFromDocument(data: any): Promise<Quiz | null> {
  try {
    const response = await api.post('/api/quiz/generate-from-document', data);
    return response.data;
  } catch (error) {
    console.error('Error generating quiz from document:', error);
    throw error;
  }
}

export async function generateThemes(data: any): Promise<any> {
  try {
    const response = await api.post('/api/quiz/themes', data);
    return response.data;
  } catch (error) {
    console.error('Error generating themes:', error);
    throw error;
  }
}

// Payment API functions
export async function createCheckoutSession(amount: number): Promise<StripeCheckoutSession | null> {
  try {
    const response = await api.post('/api/payments/create-checkout-session', { amount });
    return response.data;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
}

export async function checkSessionStatus(sessionId: string): Promise<any> {
  try {
    const response = await api.get(`/api/payments/session/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error checking session status:', error);
    throw error;
  }
}

// Game API functions
export interface ActiveGame {
  id: string;
  code: string;
  status: string;
  playerCount: number;
  activePlayerCount: number;
  currentQuestionIndex: number;
  hostDisconnectedAt?: string;
  lastActivityAt?: string;
}

export async function fetchActiveGames(): Promise<ActiveGame[]> {
  try {
    const response = await api.get('/api/games/active');
    return response.data.activeGames || [];
  } catch (error) {
    console.error('Error fetching active games:', error);
    return [];
  }
}