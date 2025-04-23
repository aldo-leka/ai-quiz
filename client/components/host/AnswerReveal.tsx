import { QuizQuestion } from 'shared';
import { Socket } from 'socket.io-client';

interface AnswerRevealProps {
  currentQuestion: QuizQuestion;
  playerAnswers: {[playerId: string]: string};
  socket: Socket | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  onNextQuestion: () => void;
}

export default function AnswerReveal({
  currentQuestion,
  playerAnswers,
  socket,
  currentQuestionIndex,
  totalQuestions,
  onNextQuestion
}: AnswerRevealProps) {

  // Get host answer using either the socket ID or the special 'host' key
  const hostAnswer = playerAnswers['host'] || playerAnswers[socket?.id || ''];
  
  console.log("-----------ANSWER REVEAL-----------");
  console.log(`socket?.id: ${socket?.id}, host answer: ${hostAnswer}`);
  console.log(hostAnswer?.toLowerCase());
  console.log(currentQuestion.correctAnswer);

  return (
    <div>
      <h3 className="text-xl font-bold mb-4">{currentQuestion.text}</h3>
      
      {/* Multiple Choice Answer Reveal */}
      {currentQuestion.type === 'multiple_choice' && currentQuestion.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {currentQuestion.options.map((option, index) => {
            const isCorrect = option === currentQuestion.correctAnswer;
            const hostSelected = hostAnswer === option;
            // Count how many players selected this option (avoiding double-counting host)
            // Convert to Set to remove duplicates, in case host answer is stored multiple times
            const uniqueAnswers = new Set(Object.values(playerAnswers));
            const optionCount = Array.from(uniqueAnswers).filter(answer => answer === option).length;
            
            return (
              <div 
                key={index} 
                className={`p-4 border-2 rounded-lg relative ${
                  isCorrect 
                    ? 'border-green-500 bg-green-50' 
                    : hostSelected 
                      ? 'border-red-500 bg-red-50' 
                      : 'border-gray-200'
                }`}
              >
                <div className="font-medium">{option}</div>
                
                {isCorrect && (
                  <div className="absolute top-2 right-2 text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                
                {/* Your answer indicator */}
                {hostSelected && !isCorrect && (
                  <div className="absolute top-2 right-2 text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
                
                {/* Empty answer indicator for host */}
                {hostAnswer === "" && option === currentQuestion.correctAnswer && (
                  <div className="absolute top-2 right-10 text-orange-500 font-bold text-xs">
                    No answer submitted (timed out)
                  </div>
                )}
                
                {/* Player count badge */}
                {optionCount > 0 && (
                  <div className="absolute bottom-2 right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {optionCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Fill in the Blank Answer Reveal */}
      {currentQuestion.type === 'fill_in_blank' && (
        <div className="mb-6">
          <div className="p-4 rounded-lg border-2 border-gray-200 mb-4">
            <div className="font-medium">Your answer:</div>
            <div className={`mt-2 p-2 rounded ${
              typeof hostAnswer === 'string' && 
              hostAnswer !== '' &&
              typeof currentQuestion.correctAnswer === 'string' && 
              hostAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase() 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {hostAnswer 
                ? hostAnswer
                : <span className="italic text-gray-600">(No answer submitted - timed out)</span>}
            </div>
          </div>
          
          <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50">
            <div className="font-medium">Correct answer:</div>
            <div className="mt-2 p-2 rounded bg-white">
              {currentQuestion.correctAnswer}
            </div>
          </div>
        </div>
      )}
      
      {/* Flashcard Answer Reveal */}
      {currentQuestion.type === 'flashcard' && (
        <div className="mb-6">
          <div className="p-6 rounded-lg bg-indigo-50 border-2 border-indigo-200">
            <div className="font-semibold text-indigo-800 mb-2">Front:</div>
            <div className="p-4 bg-white rounded mb-4">
              {currentQuestion.front || currentQuestion.text}
            </div>
            
            <div className="font-semibold text-indigo-800 mb-2">Back:</div>
            <div className="p-4 bg-white rounded">
              {currentQuestion.back || currentQuestion.correctAnswer}
            </div>
          </div>
        </div>
      )}
      
      {currentQuestion.explanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-1">Explanation</h4>
          <p className="text-blue-800">{currentQuestion.explanation}</p>
        </div>
      )}
      
      {/* Host's result indicator */}
      {(currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'fill_in_blank') && (
        <div className="mb-6 text-center">
          {typeof hostAnswer === 'string' && 
           hostAnswer !== '' &&
           typeof currentQuestion.correctAnswer === 'string' && 
           hostAnswer?.toLowerCase() === currentQuestion.correctAnswer.toLowerCase() ? (
            <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold">
              ✓ Your answer is correct!
            </div>
          ) : hostAnswer === "" ? (
            <div className="inline-block bg-orange-100 text-orange-800 px-4 py-2 rounded-lg font-bold">
              ⏱ No answer submitted (timed out)
            </div>
          ) : (
            <div className="inline-block bg-red-100 text-red-800 px-4 py-2 rounded-lg font-bold">
              ✗ Your answer is incorrect
            </div>
          )}
        </div>
      )}
      
      <div className="flex justify-end">
        <div className="relative">
          <button
            // Always just call onNextQuestion, which will either go to next question
            // or end the game if it's the last question
            onClick={onNextQuestion}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            {currentQuestionIndex >= totalQuestions - 1 ? 'Finish Game' : 'Next Question'}
          </button>
        </div>
      </div>
    </div>
  );
}