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
  questionCount: number
): Promise<Quiz> {
  // Get the appropriate prompt based on quiz type
  const prompt = getQuizPrompt(type, theme, questionCount);
  
  try {
    // Call OpenAI API to generate quiz
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert quiz creator who creates educational and engaging quizzes.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
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
