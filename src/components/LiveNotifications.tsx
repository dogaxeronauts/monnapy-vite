import { useEffect, useState } from 'react';

interface ScoreUpdate {
  address: string;
  score: number;
  tier: string;
  timestamp: number;
}

interface LiveScoreAnimationProps {
  updates: ScoreUpdate[];
}

export const LiveScoreNotification: React.FC<{ update: ScoreUpdate }> = ({ update }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-sm border-2 border-purple-500/50 rounded-lg p-4 shadow-2xl max-w-xs">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <p className="text-xs font-['Press_Start_2P'] text-white mb-1">
              LIVE UPDATE
            </p>
            <p className="text-xs text-purple-200">
              {update.address.slice(0, 6)}...{update.address.slice(-4)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-['Press_Start_2P'] text-yellow-300">
                {update.score.toLocaleString()}
              </span>
              <span 
                className="text-xs px-2 py-1 rounded-full border"
                style={{ 
                  color: getTierColor(update.tier), 
                  backgroundColor: `${getTierColor(update.tier)}15`,
                  borderColor: `${getTierColor(update.tier)}40`
                }}
              >
                {update.tier}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LivePlayerJoinNotification: React.FC<{ address: string; count: number }> = ({ address, count }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-4 z-50 animate-slide-in-left">
      <div className="bg-gradient-to-r from-green-900/95 to-emerald-900/95 backdrop-blur-sm border-2 border-green-500/50 rounded-lg p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="text-green-400">🎮</span>
          <div>
            <p className="text-xs font-['Press_Start_2P'] text-white">
              PLAYER JOINED
            </p>
            <p className="text-xs text-green-200">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
            <p className="text-xs text-green-300 mt-1">
              {count} players online
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to get tier colors
const getTierColor = (tier: string): string => {
  switch (tier) {
    case 'MYTHIC': return '#FF00FF';
    case 'LEGENDARY': return '#FFD700';
    case 'DIAMOND': return '#B9F2FF';
    case 'PLATINUM': return '#E5E4E2';
    case 'GOLD': return '#FFD700';
    case 'SILVER': return '#C0C0C0';
    case 'BRONZE': return '#CD7F32';
    case 'REGULAR': return '#10B981';
    default: return '#6B7280';
  }
};

// Hook for managing live notifications
export const useLiveNotifications = () => {
  const [scoreUpdates, setScoreUpdates] = useState<ScoreUpdate[]>([]);
  const [playerJoins, setPlayerJoins] = useState<Array<{ address: string; count: number; id: string }>>([]);

  const addScoreUpdate = (update: ScoreUpdate) => {
    const id = `${update.address}-${update.timestamp}`;
    setScoreUpdates(prev => [...prev.slice(-2), { ...update, id } as any]);
    
    // Remove after 4 seconds
    setTimeout(() => {
      setScoreUpdates(prev => prev.filter((u: any) => u.id !== id));
    }, 4000);
  };

  const addPlayerJoin = (address: string, count: number) => {
    const id = `${address}-${Date.now()}`;
    setPlayerJoins(prev => [...prev.slice(-2), { address, count, id }]);
    
    // Remove after 3 seconds
    setTimeout(() => {
      setPlayerJoins(prev => prev.filter(p => p.id !== id));
    }, 3000);
  };

  return {
    scoreUpdates,
    playerJoins,
    addScoreUpdate,
    addPlayerJoin
  };
};
