import supabase from './supabase';
import { Quiz, QuizQuestion } from 'shared';

/**
 * Save a quiz to the database
 */
export async function saveQuiz(quiz: Quiz): Promise<string | null> {
  try {
    // Insert the quiz
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        title: quiz.title,
        description: quiz.description,
        theme: quiz.theme,
        type: quiz.type,
        created_by_id: quiz.createdById,
        image_url: quiz.imageUrl,
        document_url: quiz.documentUrl,
        time_limit: quiz.timeLimit
      })
      .select('id')
      .single();
    
    if (quizError) {
      console.error('Error saving quiz:', quizError);
      return null;
    }
    
    // Insert the questions
    const questionsToInsert = quiz.questions.map(question => ({
      text: question.text,
      type: question.type,
      options: question.options || [],
      correct_answer: Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer],
      explanation: question.explanation,
      image_url: question.image_url,
      quiz_id: quizData.id
    }));
    
    const { error: questionsError } = await supabase
      .from('questions')
      .insert(questionsToInsert);
    
    if (questionsError) {
      console.error('Error saving questions:', questionsError);
      // If questions fail to save, delete the quiz to maintain consistency
      await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizData.id);
      return null;
    }
    
    return quizData.id;
  } catch (error) {
    console.error('Error in saveQuiz:', error);
    return null;
  }
}

/**
 * Get a quiz by ID with its questions
 */
export async function getQuizById(quizId: string): Promise<Quiz | null> {
  try {
    // Get the quiz
    const { data: quizData, error: quizError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
    
    if (quizError) {
      console.error('Error fetching quiz:', quizError);
      return null;
    }
    
    // Get the questions
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('id');
    
    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return null;
    }
    
    // Transform the questions
    const questions: QuizQuestion[] = questionsData.map(q => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options,
      correctAnswer: q.correct_answer.length === 1 ? q.correct_answer[0] : q.correct_answer,
      explanation: q.explanation,
      image_url: q.image_url
    }));
    
    // Combine into a quiz object
    const quiz: Quiz = {
      id: quizData.id,
      title: quizData.title,
      description: quizData.description,
      theme: quizData.theme,
      type: quizData.type,
      createdById: quizData.created_by_id,
      createdAt: quizData.created_at,
      imageUrl: quizData.image_url,
      documentUrl: quizData.document_url,
      timeLimit: quizData.time_limit,
      questions
    };
    
    return quiz;
  } catch (error) {
    console.error('Error in getQuizById:', error);
    return null;
  }
}

/**
 * Get quizzes by user ID
 */
export async function getQuizzesByUserId(userId: string): Promise<Quiz[]> {
  try {
    // Get the quizzes
    const { data: quizzesData, error: quizzesError } = await supabase
      .from('quizzes')
      .select('*')
      .eq('created_by_id', userId)
      .order('created_at', { ascending: false });
    
    if (quizzesError) {
      console.error('Error fetching quizzes:', quizzesError);
      return [];
    }
    
    // For each quiz, get its questions
    const quizzes: Quiz[] = [];
    
    for (const quizData of quizzesData) {
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizData.id)
        .order('id');
      
      if (questionsError) {
        console.error(`Error fetching questions for quiz ${quizData.id}:`, questionsError);
        continue;
      }
      
      // Transform the questions
      const questions: QuizQuestion[] = questionsData.map(q => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options: q.options,
        correctAnswer: q.correct_answer.length === 1 ? q.correct_answer[0] : q.correct_answer,
        explanation: q.explanation,
        image_url: q.image_url
      }));
      
      // Combine into a quiz object
      const quiz: Quiz = {
        id: quizData.id,
        title: quizData.title,
        description: quizData.description,
        theme: quizData.theme,
        type: quizData.type,
        createdById: quizData.created_by_id,
        createdAt: quizData.created_at,
        imageUrl: quizData.image_url,
        documentUrl: quizData.document_url,
        timeLimit: quizData.time_limit,
        questions
      };
      
      quizzes.push(quiz);
    }
    
    return quizzes;
  } catch (error) {
    console.error('Error in getQuizzesByUserId:', error);
    return [];
  }
}
