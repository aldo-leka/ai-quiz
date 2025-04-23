import { Socket } from 'socket.io-client';
import { EVENTS } from 'shared';

interface LobbyScreenProps {
  gameCode: string;
  socket: Socket | null;
}

export default function LobbyScreen({ gameCode, socket }: LobbyScreenProps) {
  const handleStartGame = () => {
    if (!socket) return;
    socket.emit(EVENTS.START_GAME, { gameCode });
  };

  return (
    <div className="text-center py-10">
      <h3 className="text-2xl font-bold mb-4">Welcome to AI Quiz!</h3>
      <p className="text-gray-600 mb-8">
        Waiting for players to join using code: <span className="font-bold text-xl">{gameCode}</span>
      </p>
      
      <button
        onClick={handleStartGame}
        className="px-6 py-3 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors"
      >
        Start Game
      </button>
    </div>
  );
}