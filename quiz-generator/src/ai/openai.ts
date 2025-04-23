import OpenAI from 'openai';
import { Quiz, QuizQuestion, QuizType } from 'shared';
import { getQuizPrompt } from '../templates/prompts';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateQuizWithOpenAI(
  theme: string,
  type: QuizType,
  questionCount: number,
  timeLimit?: number
): Promise<Quiz> {
  // Get the appropriate prompt based on quiz type
  const prompt = getQuizPrompt(type, theme, questionCount, timeLimit);
  
  try {
    // Call OpenAI API to generate quiz
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert quiz creator who creates educational and engaging quizzes. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    // Parse the response
    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No content in response');
    }
    
    const quizData = JSON.parse(responseContent);
    
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
      timeLimit: timeLimit, // Include the time limit if specified
    };
    
    return quiz;
  } catch (error) {
    console.error('Error generating quiz with OpenAI:', error);
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
    default:
      return 'multiple_choice';
  }
}
