import { Quiz, CreateQuizRequest, GenerateQuizThemesRequest, GenerateQuizThemesResponse, AiService } from 'shared';
import { generateQuizWithOpenAI } from './ai/openai';
import { generateQuizWithClaude } from './ai/claude';
import { generateQuizFromDocumentContent } from './rag/generator';
import { generateThemes } from './themes/generator';

/**
 * Generates a quiz based on the given request parameters
 */
export async function generateQuiz(request: CreateQuizRequest): Promise<Quiz> {
  const { theme, type, questionCount, aiService } = request;
  
  // Validate inputs
  if (!theme || !type || !questionCount) {
    throw new Error('Missing required parameters: theme, type, or questionCount');
  }
  
  if (questionCount < 5 || questionCount > 50) {
    throw new Error('Question count must be between 5 and 50');
  }
  
  // Choose AI service based on request
  try {
    if (aiService === 'claude') {
      return await generateQuizWithClaude(theme, type, questionCount, request.timeLimit);
    } else {
      return await generateQuizWithOpenAI(theme, type, questionCount, request.timeLimit);
    }
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw new Error('Failed to generate quiz');
  }
}

/**
 * Generates a quiz from a document URL using RAG
 */
export async function generateQuizFromDocument(request: CreateQuizRequest): Promise<Quiz> {
  const { documentUrl, type, questionCount, aiService } = request;
  
  // Validate inputs
  if (!documentUrl) {
    throw new Error('Missing required parameter: documentUrl');
  }
  
  if (!type || !questionCount) {
    throw new Error('Missing required parameters: type or questionCount');
  }
  
  if (questionCount < 5 || questionCount > 50) {
    throw new Error('Question count must be between 5 and 50');
  }
  
  try {
    // Process document and generate quiz
    return await generateQuizFromDocumentContent(documentUrl, type, questionCount, aiService as AiService, request.timeLimit);
  } catch (error) {
    console.error('Error generating quiz from document:', error);
    throw new Error('Failed to generate quiz from document');
  }
}

/**
 * Generates quiz theme suggestions
 */
export async function generateQuizThemes(request: GenerateQuizThemesRequest): Promise<GenerateQuizThemesResponse> {
  const { count, category, audience } = request;
  
  // Validate inputs
  if (!count || count < 1 || count > 10) {
    throw new Error('Invalid count. Must be between 1 and 10.');
  }
  
  try {
    const themes = await generateThemes(count, category, audience);
    return { themes };
  } catch (error) {
    console.error('Error generating themes:', error);
    throw new Error('Failed to generate quiz themes');
  }
}
