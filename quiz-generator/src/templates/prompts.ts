import { QuizType } from 'shared';

/**
 * Returns the appropriate prompt for generating a quiz based on the type and difficulty
 */
export function getQuizPrompt(
  type: QuizType, 
  theme: string, 
  questionCount: number, 
  difficulty?: 'beginner' | 'intermediate' | 'advanced',
  timeLimit?: number
): string {
  const timedInstructions = timeLimit 
    ? `This is a timed quiz with ${timeLimit} seconds per question.` 
    : '';
    
  const difficultyInstructions = difficulty
    ? `The difficulty level should be ${difficulty.toUpperCase()}.`
    : '';
  
  const basePrompt = `Create a ${type} quiz about ${theme} with ${questionCount} questions. ${difficultyInstructions} ${timedInstructions}
  Return the response as a JSON object with the following structure:
  {
    "title": "Quiz title",
    "description": "Brief description of the quiz",
    "questions": [
      {
        "question": "Question text",
        "options": ["Option A", "Option B", "Option C", "Option D"], (for multiple choice)
        "correctAnswer": "Correct answer or array of correct answers",
        "explanation": "Explanation of the correct answer"
      }
    ]
  }
  `;
  
  // Add type-specific instructions
  switch (type) {
    case 'multiple_choice':
      return basePrompt + `
      For multiple choice questions:
      - Each question should have exactly 4 options
      - Only one option should be correct
      - The correctAnswer should be the exact text of the correct option
      - Make the questions engaging and varied in difficulty
      `;
      
    case 'true_false':
      return basePrompt + `
      For true/false questions:
      - Each question should be a statement that is either true or false
      - The options should be ["True", "False"]
      - The correctAnswer should be "True" or "False"
      - Include a mix of true and false statements
      `;
      
    case 'flashcards':
      return basePrompt + `
      For flashcard questions:
      - The question should be a clear, concise prompt or term
      - No options are needed
      - The correctAnswer should be the comprehensive answer/definition
      - Make the answers informative but concise
      `;
      
    case 'fill_in_blank':
      return basePrompt + `
      For fill-in-the-blank questions:
      - The question should be a sentence with a blank indicated by "___"
      - No options are needed
      - The correctAnswer should be the word or phrase that fills in the blank
      - Make sure the context provides enough clues to determine the answer
      `;
      
    default:
      return basePrompt;
  }
}
