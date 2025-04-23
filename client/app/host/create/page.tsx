"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QuizType, QUIZ_TYPES, AiService, AI_SERVICES, QuizTheme } from 'shared';

export default function CreateQuiz() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [quizType, setQuizType] = useState<QuizType>('multiple_choice');
  const [questionCount, setQuestionCount] = useState(10);
  const [aiService, setAiService] = useState<AiService>('openai');
  const [selectedTheme, setSelectedTheme] = useState<QuizTheme | null>(null);
  const [suggestedThemes, setSuggestedThemes] = useState<QuizTheme[]>([]);
  const [customDocumentUrl, setCustomDocumentUrl] = useState('');
  const [useCustomDocument, setUseCustomDocument] = useState(false);
  const [timeLimit, setTimeLimit] = useState(30); // Default time limit: 30 seconds
  const [timedQuiz, setTimedQuiz] = useState(true); // Default: timed quiz enabled
  
  // Load suggested themes
  useEffect(() => {
    async function loadThemes() {
      try {
        setIsLoading(true);
        const { generateThemes } = await import('@/lib/api');
        
        // Get themes for popular categories
        const themesData = await generateThemes({
          count: 4,
          audience: 'mixed'
        });
        
        if (themesData && themesData.themes) {
          setSuggestedThemes(themesData.themes);
        }
      } catch (error) {
        console.error('Error loading themes:', error);
        
        // Fallback to mock themes if API fails
        const mockThemes: QuizTheme[] = [
          {
            title: 'Space Exploration',
            description: 'Test your knowledge about planets, stars, and space missions.',
            exampleQuestions: ['What is the largest planet in our solar system?'],
            audience: 'intermediate',
            imageUrl: 'https://placehold.co/100x100?text=Space'
          },
          {
            title: 'Marvel Superheroes',
            description: 'Challenge yourself with questions about Marvel comics and movies.',
            exampleQuestions: ['Who is Iron Man\'s alter ego?'],
            audience: 'beginner',
            imageUrl: 'https://placehold.co/100x100?text=Marvel'
          },
          {
            title: 'World Geography',
            description: 'How well do you know countries, capitals, and landmarks?',
            exampleQuestions: ['What is the capital of Australia?'],
            audience: 'intermediate',
            imageUrl: 'https://placehold.co/100x100?text=Geography'
          },
          {
            title: 'Music History',
            description: 'From classical to rock and pop, test your music knowledge.',
            exampleQuestions: ['Which band performed "Bohemian Rhapsody"?'],
            audience: 'intermediate',
            imageUrl: 'https://placehold.co/100x100?text=Music'
          },
        ];
        
        setSuggestedThemes(mockThemes);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadThemes();
  }, []);
  
  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      let quizId = '';
      
      if (useCustomDocument) {
        // Generate a quiz from a document
        const { generateQuizFromDocument } = await import('@/lib/api');
        const quiz = await generateQuizFromDocument({
          documentUrl: customDocumentUrl,
          questionCount,
          type: quizType,
          timeLimit: timedQuiz ? timeLimit : undefined
        });
        
        if (quiz?.id) {
          quizId = quiz.id;
        } else {
          throw new Error('Failed to generate quiz from document');
        }
      } else if (selectedTheme) {
        // Generate a quiz from a theme
        const { generateQuiz } = await import('@/lib/api');
        const quiz = await generateQuiz({
          theme: selectedTheme.title,
          type: quizType,
          questionCount,
          aiService,
          timeLimit: timedQuiz ? timeLimit : undefined
        });
        
        if (quiz?.id) {
          quizId = quiz.id;
        } else {
          throw new Error('Failed to generate quiz');
        }
      } else {
        throw new Error('No theme or document selected');
      }
      
      // Redirect to the lobby with the quiz ID
      router.push(`/host/lobby?quizId=${quizId}`);
    } catch (error: any) {
      console.error('Error creating quiz:', error);
      alert(`Failed to create quiz: ${error.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };
  
  const handleNextStep = () => {
    setStep(prevStep => prevStep + 1);
  };
  
  const handlePrevStep = () => {
    setStep(prevStep => prevStep - 1);
  };
  
  // Render different content based on current step
  let content;
  switch (step) {
    case 1: // Quiz type selection
      content = (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4">Choose Quiz Type</h2>
          
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(QUIZ_TYPES).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setQuizType(value as QuizType)}
                className={`p-4 border-2 rounded-lg text-left ${quizType === value ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
              >
                <div className="font-medium">{formatQuizType(value)}</div>
                <div className="text-sm text-gray-600 mt-1">{getQuizTypeDescription(value)}</div>
              </button>
            ))}
          </div>
          
          <div className="flex justify-between pt-4">
            <Link 
              href="/host"
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </Link>
            
            <button
              onClick={handleNextStep}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Next
            </button>
          </div>
        </div>
      );
      break;
    
    case 2: // Theme selection
      content = (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Choose a Theme</h2>
            <button 
              onClick={async () => {
                try {
                  setIsLoading(true);
                  const { generateThemes } = await import('@/lib/api');
                  
                  // Get new random themes
                  const themesData = await generateThemes({
                    count: 4,
                    audience: 'mixed'
                  });
                  
                  if (themesData && themesData.themes) {
                    setSuggestedThemes(themesData.themes);
                  }
                } catch (error) {
                  console.error('Error refreshing themes:', error);
                  alert('Failed to load new themes. Please try again.');
                } finally {
                  setIsLoading(false);
                }
              }}
              className="p-2 bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200"
              title="Generate new random themes"
              disabled={isLoading}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              )}
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {suggestedThemes.map((theme, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedTheme(theme);
                    setUseCustomDocument(false);
                  }}
                  className={`p-4 border-2 rounded-lg text-left flex ${selectedTheme === theme ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
                >
                  {theme.imageUrl && (
                    <div className="mr-3">
                      <div className="w-16 h-16 rounded bg-gray-200 overflow-hidden">
                        <img src={theme.imageUrl} alt={theme.title} className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{theme.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{theme.description}</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => {
                  setUseCustomDocument(true);
                  setSelectedTheme(null);
                }}
                className={`p-4 border-2 rounded-lg text-left w-full ${useCustomDocument ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
              >
                <div className="font-medium">Upload Custom Document</div>
                <div className="text-sm text-gray-600 mt-1">Create a quiz from your own PDF or DOCX file</div>
              </button>
            </div>
            
            {useCustomDocument && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document URL
                </label>
                <input
                  type="text"
                  value={customDocumentUrl}
                  onChange={(e) => setCustomDocumentUrl(e.target.value)}
                  placeholder="Enter document URL or upload file"
                  className="w-full px-4 py-2 border rounded-md"
                />
                <div className="mt-2">
                  <button className="text-sm text-indigo-600 hover:text-indigo-800">
                    Or click to upload file
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-between pt-4">
            <button
              onClick={handlePrevStep}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back
            </button>
            
            <button
              onClick={handleNextStep}
              disabled={!selectedTheme && !useCustomDocument}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              Next
            </button>
          </div>
        </div>
      );
      break;
    
    case 3: // Final settings
      content = (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold mb-4">Quiz Settings</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Questions
            </label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="5">5 questions</option>
              <option value="10">10 questions</option>
              <option value="15">15 questions</option>
              <option value="20">20 questions</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Service
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(AI_SERVICES).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setAiService(value as AiService)}
                  className={`p-3 border-2 rounded-lg ${aiService === value ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
                >
                  {formatAiService(value)}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Timed Quiz
              </label>
              <div className="relative inline-block w-10 mr-2 align-middle select-none">
                <input 
                  type="checkbox"
                  checked={timedQuiz}
                  onChange={(e) => setTimedQuiz(e.target.checked)}
                  className="absolute block w-6 h-6 rounded-full bg-white border-4 cursor-pointer appearance-none"
                  style={{
                    top: '0px',
                    left: timedQuiz ? '4px' : '-4px',
                    transition: 'left 0.2s ease-in-out',
                    backgroundColor: timedQuiz ? '#4F46E5' : 'white',
                    borderColor: timedQuiz ? '#4F46E5' : '#D1D5DB'
                  }}
                />
                <label 
                  className={`block overflow-hidden h-6 rounded-full cursor-pointer ${timedQuiz ? 'bg-indigo-100' : 'bg-gray-300'}`}
                  style={{ transition: 'background-color 0.2s ease-in-out' }}
                ></label>
              </div>
            </div>
            
            {timedQuiz && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Limit (seconds)
                </label>
                <select
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border rounded-md"
                >
                  <option value="10">10 seconds</option>
                  <option value="15">15 seconds</option>
                  <option value="20">20 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="45">45 seconds</option>
                  <option value="60">60 seconds</option>
                </select>
              </div>
            )}
          </div>
          
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h3 className="font-medium">Quiz Summary</h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li><span className="text-gray-600">Type:</span> {formatQuizType(quizType)}</li>
              <li><span className="text-gray-600">Theme:</span> {selectedTheme?.title || 'Custom Document'}</li>
              <li><span className="text-gray-600">Questions:</span> {questionCount}</li>
              <li><span className="text-gray-600">Time Limit:</span> {timedQuiz ? `${timeLimit} seconds per question` : 'No time limit'}</li>
              <li><span className="text-gray-600">AI Service:</span> {formatAiService(aiService)}</li>
              <li><span className="text-gray-600">Cost:</span> 1 credit</li>
            </ul>
          </div>
          
          <div className="flex justify-between pt-4">
            <button
              onClick={handlePrevStep}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {isLoading ? 'Creating Quiz...' : 'Create Quiz'}
            </button>
          </div>
        </div>
      );
      break;
      
    default:
      content = <p>Something went wrong...</p>;
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-700 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Create AI Quiz
          </h1>
          
          <div className="mb-8 flex justify-between relative">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex flex-col items-center relative z-10">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${stepNumber === step ? 'bg-indigo-600 text-white' : stepNumber < step ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-600'}`}
                >
                  {stepNumber}
                </div>
                <div className="text-xs mt-1 text-gray-600">
                  {stepNumber === 1 ? 'Type' : stepNumber === 2 ? 'Theme' : 'Settings'}
                </div>
              </div>
            ))}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-10"></div>
          </div>
          
          {content}
        </div>
      </div>
    </main>
  );
}

// Helper functions
function formatQuizType(type: string): string {
  switch(type) {
    case 'multiple_choice': return 'Multiple Choice';
    case 'true_false': return 'True/False';
    case 'flashcards': return 'Flashcards';
    case 'fill_in_blank': return 'Fill in the Blank';
    default: return type;
  }
}

function getQuizTypeDescription(type: string): string {
  switch(type) {
    case 'multiple_choice': 
      return 'Questions with multiple choice answers. Only one answer is correct.';
    case 'true_false': 
      return 'Simple true or false questions to test knowledge.';
    case 'flashcards': 
      return 'Two-sided cards with questions and answers for study sessions.';
    case 'fill_in_blank': 
      return 'Complete the sentences by filling in missing words.';
    default: 
      return '';
  }
}

function formatAiService(service: string): string {
  switch(service) {
    case 'openai': return 'OpenAI';
    case 'claude': return 'Claude';
    default: return service;
  }
}