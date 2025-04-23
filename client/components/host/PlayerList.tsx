import { Player } from 'shared';

interface PlayerListProps {
  players: Player[];
}

export default function PlayerList({ players }: PlayerListProps) {
  return (
    <div className="bg-white rounded-lg shadow-xl overflow-hidden">
      <div className="p-4 bg-indigo-600 text-white">
        <h2 className="text-lg font-semibold">Players</h2>
      </div>
      <div className="p-4 max-h-[70vh] overflow-y-auto">
        {players.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No players have joined yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map(player => (
              <div 
                key={player.id} 
                className={`flex items-center justify-between p-3 rounded-lg ${player.isConnected ? 'bg-gray-50' : 'bg-gray-100 opacity-60'}`}
              >
                <div className="flex items-center">
                  <div className="text-2xl mr-2">{player.avatar}</div>
                  <div className="font-medium">{player.name}</div>
                </div>
                <div className="font-bold">{player.score}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}