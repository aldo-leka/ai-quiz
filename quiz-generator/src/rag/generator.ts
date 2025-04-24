import { Quiz, AiService, QuizType } from 'shared';
import { generateQuizWithOpenAI } from '../ai/openai';
import { generateQuizWithClaude } from '../ai/claude';
import { processDocument } from './parsers/documentProcessor';

/**
 * Generates a quiz from a document URL using RAG
 */
export async function generateQuizFromDocumentContent(
  documentUrl: string,
  type: QuizType,
  questionCount: number,
  aiService: AiService,
  timeLimit?: number,
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
): Promise<Quiz> {
  try {
    // Fetch and process the document
    const documentContent = await processDocument(documentUrl);
    
    // Create a theme from the document content
    const theme = `Content from uploaded document (${documentContent.title || 'Untitled'})`;
    
    // Generate quiz based on document content
    let quiz: Quiz;
    
    if (aiService === 'claude') {
      quiz = await generateQuizWithClaude(theme, type, questionCount, difficulty, timeLimit);
    } else {
      quiz = await generateQuizWithOpenAI(theme, type, questionCount, difficulty, timeLimit);
    }
    
    // Set document URL in the quiz object
    quiz.documentUrl = documentUrl;
    
    return quiz;
  } catch (error) {
    console.error('Error in RAG quiz generation:', error);
    throw new Error('Failed to generate quiz from document');
  }
}
