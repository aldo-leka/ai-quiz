import Link from 'next/link';
import { Socket } from 'socket.io-client';

interface GameFinishedProps {
  socket: Socket | null;
  gameCode: string;
  hostAnswer: string;
  onVote: (option: string) => void;
}

export default function GameFinished({
  socket,
  gameCode,
  hostAnswer,
  onVote
}: GameFinishedProps) {
  return (
    <div className="py-10">
      <h3 className="text-2xl font-bold mb-4 text-center">Game Completed!</h3>
      
      {/* Host's options */}
      <div className="bg-white rounded-lg border border-indigo-200 p-6 mb-8">
        <h4 className="text-xl font-semibold mb-4">What would you like to do next?</h4>
        
        <div className="space-y-4 mb-6">
          <button
            onClick={() => onVote('same_quiz')}
            className={`w-full py-3 px-4 rounded-lg border-2 text-left ${hostAnswer === 'voted_same_quiz' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
          >
            <div className="font-semibold">Play Again - Same Questions</div>
            <div className="text-sm text-gray-500">Replay this exact quiz</div>
          </button>
          
          <button
            onClick={() => onVote('new_quiz_same_theme')}
            className={`w-full py-3 px-4 rounded-lg border-2 text-left ${hostAnswer === 'voted_new_quiz_same_theme' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
          >
            <div className="font-semibold">New Quiz - Same Theme</div>
            <div className="text-sm text-gray-500">New questions on the same topic</div>
          </button>
          
          <button
            onClick={() => onVote('new_theme')}
            className={`w-full py-3 px-4 rounded-lg border-2 text-left ${hostAnswer === 'voted_new_theme' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'}`}
          >
            <div className="font-semibold">New Quiz - New Theme</div>
            <div className="text-sm text-gray-500">Choose a completely new topic</div>
          </button>
        </div>
      </div>
      
      <div className="mt-6 flex justify-center space-x-4">
        <Link 
          href="/host"
          className="px-6 py-3 border border-gray-300 rounded-md font-medium hover:bg-gray-50 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}