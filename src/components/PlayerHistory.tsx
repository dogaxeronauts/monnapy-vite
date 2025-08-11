import React from 'react';

interface PlayerHistoryProps {
  playerHistory: any[];
  isVisible: boolean;
  onClose: () => void;
  playerAddress: string;
}

const PlayerHistory: React.FC<PlayerHistoryProps> = ({
  playerHistory,
  isVisible,
  onClose,
  playerAddress
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 p-6 rounded-lg border border-purple-500/30 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-['Press_Start_2P'] text-yellow-300">
            Player History
          </h3>
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-300 text-xl"
          >
            ×
          </button>
        </div>
        
        <div className="text-center text-slate-400">
          <p className="text-sm mb-2">Player: {playerAddress.slice(0, 8)}...{playerAddress.slice(-6)}</p>
          {playerHistory.length > 0 ? (
            <p className="text-xs">{playerHistory.length} games recorded</p>
          ) : (
            <p className="text-xs">History feature coming soon!</p>
          )}
        </div>
        
        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default PlayerHistory;
