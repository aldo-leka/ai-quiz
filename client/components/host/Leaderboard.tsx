import { Player } from 'shared';

interface LeaderboardProps {
  players: Player[];
  currentQuestionIndex: number;
  totalQuestions: number;
  leaderboardTimer?: boolean; // Make optional since we're not using it anymore
  onNextQuestion: () => void;
  onEndGame: () => void;
  onPlayAgain?: () => void;
}

export default function Leaderboard({
  players,
  currentQuestionIndex,
  totalQuestions,
  onNextQuestion,
  onEndGame,
  onPlayAgain
}: LeaderboardProps) {
  return (
    <div>
      <h3 className="text-2xl font-bold mb-6 text-center">
        {currentQuestionIndex >= totalQuestions - 1 ? 'Final Results' : 'Leaderboard'}
      </h3>
      
      <div className="space-y-2 mb-8">
        {players
          .sort((a, b) => b.score - a.score)
          .map((player, index) => (
            <div 
              key={player.id} 
              className={`flex items-center justify-between p-4 rounded-lg ${index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : index === 2 ? 'bg-orange-100' : 'bg-white border'}`}
            >
              <div className="flex items-center">
                <div className="w-8 text-center font-bold mr-3">{index + 1}</div>
                <div className="text-2xl mr-2">{player.avatar}</div>
                <div className="font-medium">{player.name}</div>
              </div>
              <div className="font-bold text-xl">{player.score}</div>
            </div>
          ))
        }
      </div>
      
      <div className="flex justify-end gap-3">
        {currentQuestionIndex >= totalQuestions - 1 ? (
          <>
            {onPlayAgain && (
              <button
                onClick={onPlayAgain}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Play Again
              </button>
            )}
            <button
              onClick={onEndGame}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              End Game
            </button>
          </>
        ) : (
          <button
            onClick={onNextQuestion}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Next Question
          </button>
        )}
      </div>
    </div>
  );
}