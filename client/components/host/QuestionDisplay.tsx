import { Socket } from 'socket.io-client';
import { QuizQuestion } from 'shared';

interface QuestionDisplayProps {
  currentQuestion: QuizQuestion;
  playerAnswers: {[playerId: string]: string};
  hostAnswer: string;
  socket: Socket | null;
  gameCode: string;
  onSelectAnswer: (answer: string) => void;
  onSubmitAnswer: () => void;
  onRevealAnswer: () => void;
  players: any[];
}

export default function QuestionDisplay({
  currentQuestion,
  playerAnswers,
  hostAnswer,
  socket,
  gameCode,
  onSelectAnswer,
  onSubmitAnswer,
  onRevealAnswer,
  players
}: QuestionDisplayProps) {
  return (
    <div>
      <h3 className="text-xl font-bold mb-6">{currentQuestion.text}</h3>
      
      {currentQuestion.type === 'multiple_choice' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {currentQuestion.options?.map((option, index) => {
              // Count how many players selected this option (avoiding double-counting host)
              // Convert to Set to remove duplicates, in case host answer is stored multiple times
              const uniqueAnswers = new Set(Object.values(playerAnswers));
              const optionCount = Array.from(uniqueAnswers).filter(answer => answer === option).length;
              const isHostSelected = hostAnswer === option;
              
              return (
                <button
                  key={index}
                  onClick={() => onSelectAnswer(option)}
                  className={`p-4 border-2 rounded-lg relative text-left hover:border-gray-300 ${isHostSelected ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
                >
                  <div className="font-medium">{option}</div>
                  
                  {/* Player count badge */}
                  {optionCount > 0 && (
                    <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {optionCount}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Host answer submission */}
          <div className="flex justify-center mb-6">
            <button 
              onClick={() => onSubmitAnswer()}
              disabled={!hostAnswer}
              className="px-6 py-3 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:bg-indigo-300"
            >
              Submit Your Answer
            </button>
          </div>
        </div>
      )}
      
      {/* Fill in the Blank Question */}
      {currentQuestion.type === 'fill_in_blank' && (
        <div className="mb-6">
          <input
            type="text"
            value={hostAnswer}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Type your answer here..."
            className="w-full p-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-600 mb-4"
          />
          
          <div className="flex justify-center mb-6">
            <button 
              onClick={() => onSubmitAnswer()}
              disabled={!hostAnswer}
              className="px-6 py-3 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors disabled:bg-indigo-300"
            >
              Submit Your Answer
            </button>
          </div>
        </div>
      )}
      
      {/* Flashcard Question */}
      {currentQuestion.type === 'flashcard' && (
        <div className="mb-6 relative">
          <div className="cursor-pointer rounded-lg shadow-lg overflow-hidden" 
               onClick={() => onSelectAnswer(hostAnswer ? '' : 'flipped')}>
            <div className={`transition-all duration-500 ${hostAnswer ? 'opacity-0 absolute' : 'opacity-100'}`}>
              <div className="bg-indigo-100 p-6 min-h-[200px] flex flex-col justify-center">
                <div className="text-xl font-medium">{currentQuestion.front || currentQuestion.text}</div>
                <div className="mt-4 text-indigo-600">Click to reveal answer</div>
              </div>
            </div>
            <div className={`transition-all duration-500 ${hostAnswer ? 'opacity-100' : 'opacity-0 absolute'}`}>
              <div className="bg-indigo-50 p-6 min-h-[200px] flex flex-col justify-center">
                <div className="text-xl font-medium">{currentQuestion.back || currentQuestion.correctAnswer}</div>
                <div className="mt-4 text-indigo-600">Click to flip back</div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-4 mb-6">
            <button 
              onClick={() => onSubmitAnswer()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors"
            >
              I've Seen The Answer
            </button>
          </div>
        </div>
      )}
      
      <div className="flex justify-between">
        <div>
          <span className="text-gray-500">
            {(() => {
              // Calculate number of answers, excluding duplicate host answers
              let answeredCount = 0;
              // Check if host has answered (either via socket.id or 'host' key)
              const hostHasAnswered = ('host' in playerAnswers) || (socket?.id && socket.id in playerAnswers);
              
              if (hostHasAnswered) {
                answeredCount = 1; // Host counts as 1
              }
              
              // Add non-host players
              const nonHostKeys = Object.keys(playerAnswers).filter(key => 
                key !== 'host' && key !== socket?.id
              );
              
              answeredCount += nonHostKeys.length;
              
              // Calculate total players (non-host players + host)
              const totalCount = players.filter(p => !p.isHost).length + 1;
              
              return `${answeredCount} of ${totalCount}`;
            })()}
            {" "}answered
          </span>
        </div>
        
        <button
          onClick={onRevealAnswer}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Reveal Answer
        </button>
      </div>
    </div>
  );
}