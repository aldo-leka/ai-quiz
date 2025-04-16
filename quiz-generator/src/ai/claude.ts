import Anthropic from '@anthropic-ai/sdk';
import { Quiz, QuizQuestion, QuizType } from 'shared';
import { getQuizPrompt } from '../templates/prompts';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateQuizWithClaude(
  theme: string,
  type: QuizType,
  questionCount: number
): Promise<Quiz> {
  // Get the appropriate prompt based on quiz type
  const prompt = getQuizPrompt(type, theme, questionCount);
  
  try {
    // Call Claude API to generate quiz
    const response = await anthropic.completions.create({
      model: 'claude-3-opus-20240229',
      max_tokens_to_sample: 4000,
      temperature: 0.7,
      prompt: `${prompt}\n\nHuman: Please create this quiz. Make sure to format your response as valid JSON.\n\nAssistant:`,
    });
    
    // Parse the response
    const responseContent = response.completion;
    if (!responseContent) {
      throw new Error('No content in response');
    }
    
    // Extract JSON from the response
    const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || 
                      responseContent.match(/{[\s\S]*}/);
                      
    if (!jsonMatch) {
      throw new Error('No valid JSON found in the response');
    }
    
    const jsonString = jsonMatch[1] || jsonMatch[0];
    const quizData = JSON.parse(jsonString);
    
    // Create quiz object from response
    const quiz: Quiz = {
      id: generateRandomId(),
      title: quizData.title || `Quiz on ${theme}`,
      description: quizData.description || `A ${type} quiz about ${theme}`,
      theme,
      type,
      questions: quizData.questions.map((q: any) => transformQuestion(q, type)),
      createdById: '',  // This will be filled in by the server
      createdAt: new Date().toISOString(),
      imageUrl: undefined, // This will be generated separately if needed
    };
    
    return quiz;
  } catch (error) {
    console.error('Error generating quiz with Claude:', error);
    throw new Error('Failed to generate quiz');
  }
}

// Helper functions
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function transformQuestion(question: any, quizType: QuizType): QuizQuestion {
  const baseQuestion: QuizQuestion = {
    id: generateRandomId(),
    text: question.question,
    type: mapQuizTypeToQuestionType(quizType),
    correctAnswer: question.correctAnswer || question.answer,
    explanation: question.explanation,
    timeLimit: question.timeLimit,
    image_url: question.imageUrl,
  };
  
  // Add options for multiple choice questions
  if (quizType === 'multiple_choice' || quizType === 'true_false') {
    baseQuestion.options = question.options || [];
  }
  
  return baseQuestion;
}

function mapQuizTypeToQuestionType(quizType: QuizType): 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_in_blank' {
  switch (quizType) {
    case 'multiple_choice':
      return 'multiple_choice';
    case 'true_false':
      return 'true_false';
    case 'flashcards':
      return 'short_answer';
    case 'fill_in_blank':
      return 'fill_in_blank';
    case 'timed':
      return 'multiple_choice';
    default:
      return 'multiple_choice';
  }
}