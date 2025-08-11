import React, { useCallback, useEffect } from 'react';
import { useStateTogether, useStateTogetherWithPerUserValues, useConnectedUsers, useNicknames } from 'react-together';

interface LeaderboardEntry {
  address: string;
  score: number;
  timestamp: number;
  tier: string;
  isOnline?: boolean;
}

interface MultiUserLeaderboardProps {
  currentPlayerAddress: string | undefined;
  currentScore?: number;
  onPlayerClick?: (address: string) => void;
  getNFTTier: (score: number) => { tier: string; color: string };
  onSubmitScore?: (submitScoreFn: (score: number) => void) => void;
}

const MultiUserLeaderboard: React.FC<MultiUserLeaderboardProps> = ({
  currentPlayerAddress,
  currentScore = 0,
  onPlayerClick,
  getNFTTier,
  onSubmitScore
}) => {
  // React Together hooks for synchronized state
  const [globalLeaderboard, setGlobalLeaderboard] = useStateTogether<LeaderboardEntry[]>('game-leaderboard', []);
  const [myBestScore, setMyBestScore] = useStateTogetherWithPerUserValues<number>('player-best-scores', 0, {
    keepValues: true,
    omitMyValue: false
  });
  
  // Get connected users and nicknames
  const connectedUsers = useConnectedUsers();
  const [, , allNicknames] = useNicknames();

  // Submit score to global leaderboard
  const submitScore = useCallback((score: number) => {
    if (!currentPlayerAddress || score === 0) return;

    const newEntry: LeaderboardEntry = {
      address: currentPlayerAddress,
      score,
      timestamp: Date.now(),
      tier: getNFTTier(score).tier,
      isOnline: true
    };

    setGlobalLeaderboard(prev => {
      // Remove any existing entries for this player
      const filtered = prev.filter(entry => entry.address !== currentPlayerAddress);
      // Add new entry and sort by score
      const updated = [...filtered, newEntry].sort((a, b) => b.score - a.score);
      // Keep only top 50 entries
      return updated.slice(0, 50);
    });
  }, [currentPlayerAddress, setGlobalLeaderboard, getNFTTier]);

  // Only update best score when score increases (but don't auto-submit)
  useEffect(() => {
    if (currentScore > myBestScore) {
      setMyBestScore(currentScore);
    }
  }, [currentScore, myBestScore, setMyBestScore]);

  // Provide submitScore function to parent component
  useEffect(() => {
    if (onSubmitScore) {
      onSubmitScore(submitScore);
    }
  }, [onSubmitScore, submitScore]);

  // Create enhanced leaderboard with online status
  const enhancedLeaderboard = React.useMemo(() => {
    const connectedUserIds = new Set(connectedUsers.map(user => user.userId));
    
    return globalLeaderboard.map(entry => ({
      ...entry,
      isOnline: connectedUserIds.has(entry.address),
      nickname: allNicknames[entry.address] || `${entry.address.slice(0, 8)}...${entry.address.slice(-6)}`
    }));
  }, [globalLeaderboard, connectedUsers, allNicknames]);

  // Get current player's rank
  const getPlayerRank = () => {
    if (!currentPlayerAddress) return null;
    const rank = enhancedLeaderboard.findIndex(entry => 
      entry.address.toLowerCase() === currentPlayerAddress.toLowerCase()) + 1;
    return rank > 0 ? rank : null;
  };

  // Get online players count
  const onlineCount = connectedUsers.length;

  return (
    <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-yellow-800 to-yellow-900 p-6 border-2 border-yellow-500/30 h-full min-h-[600px] xl:min-h-[calc(75vh-8rem)] flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent"></div>
      
      {/* Enhanced Leaderboard Header with Data Source Indicator */}
      <div className="text-center mb-6 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <h3 className="font-['Press_Start_2P'] text-sm text-yellow-300">🏆 HALL OF FAME</h3>
          {/* Data Source Badge */}
          <div className="px-2 py-1 rounded-full text-xs font-bold border bg-blue-900/80 border-blue-400 text-blue-300">
            LIVE SYNC
          </div>
        </div>
        <div className="flex justify-center items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-yellow-200">LIVE</span>
          </div>
          <div className="text-yellow-300">
            TOP {Math.min(enhancedLeaderboard.length, 15)} PLAYERS
            <span className="ml-2 text-xs text-green-400 font-bold">🌐 GLOBAL</span>
          </div>
        </div>
      </div>

      {/* Enhanced Leaderboard Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 bg-slate-900/40 rounded-lg border border-yellow-500/20">
          <p className="text-sm text-yellow-300 font-['Press_Start_2P'] mb-1">
            {onlineCount}
          </p>
          <p className="text-xs text-yellow-200">🟢 ONLINE</p>
        </div>
        
        {currentPlayerAddress && (() => {
          const playerRank = getPlayerRank();
          return (
            <div className="text-center p-3 bg-slate-900/40 rounded-lg border border-yellow-500/20">
              <p className="text-sm text-yellow-300 font-['Press_Start_2P'] mb-1">
                {playerRank ? `#${playerRank}` : '--'}
              </p>
              <p className="text-xs text-yellow-200">YOUR RANK</p>
            </div>
          );
        })()}
      </div>

      {/* Scrollable Leaderboard */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar relative z-10">
        {enhancedLeaderboard.length > 0 ? (
          enhancedLeaderboard.slice(0, 15).map((entry, index) => (
            <div 
              key={`${entry.address}-${entry.timestamp}`} 
              className={`relative flex justify-between items-center p-4 rounded-lg border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                currentPlayerAddress && entry.address.toLowerCase() === currentPlayerAddress.toLowerCase()
                  ? 'bg-gradient-to-r from-yellow-900/80 to-yellow-800/60 border-yellow-400/60 shadow-lg shadow-yellow-500/20'
                  : 'bg-gradient-to-r from-slate-900/80 to-slate-800/60 border-yellow-500/30 hover:border-yellow-400/50'
              }`}
              onClick={() => onPlayerClick?.(entry.address)}
              style={{ cursor: onPlayerClick ? 'pointer' : 'default' }}
            >
              {/* Animated rank badge with enhanced effects */}
              <div className="flex items-center gap-4">
                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-['Press_Start_2P'] border-2 ${
                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 border-yellow-300 text-black' :
                  index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 border-gray-200 text-black' :
                  index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 border-amber-400 text-white' :
                  'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-500 text-yellow-300'
                }`}>
                  {index < 3 ? (
                    <span className="text-lg">
                      {index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}
                    </span>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                  
                  {/* Crown glow effect for #1 */}
                  {index === 0 && (
                    <div className="absolute inset-0 rounded-full bg-yellow-400/30"></div>
                  )}
                </div>
                
                {/* Player Info */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-['Press_Start_2P']">
                      {entry.nickname}
                    </span>
                    {/* Online indicator */}
                    <div className={`w-2 h-2 rounded-full ${
                      entry.isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                    }`} title={entry.isOnline ? 'Online' : 'Offline'} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-xs font-['Press_Start_2P'] px-2 py-1 rounded-full border"
                      style={{ 
                        color: getNFTTier(entry.score).color, 
                        backgroundColor: `${getNFTTier(entry.score).color}15`,
                        borderColor: `${getNFTTier(entry.score).color}40`
                      }}
                    >
                      {entry.tier}
                    </span>
                    {index < 3 && (
                      <span className="text-xs text-yellow-400">✨</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Enhanced score with pulse and formatting */}
              <div className="text-right">
                <div className={`text-sm font-['Press_Start_2P'] mb-1 transition-all duration-300 ${
                  index === 0 ? 'text-yellow-300 text-base' :
                  index === 1 ? 'text-gray-300 text-sm' :
                  index === 2 ? 'text-amber-600 text-sm' :
                  'text-yellow-300'
                }`}>
                  {entry.score.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </div>
              </div>

              {/* Animated background for top 3 */}
              {index < 3 && (
                <div className="absolute inset-0 opacity-10 rounded-lg"
                     style={{
                       background: index === 0 ? 'linear-gradient(45deg, #fbbf24, #f59e0b)' :
                                  index === 1 ? 'linear-gradient(45deg, #d1d5db, #9ca3af)' :
                                  'linear-gradient(45deg, #d97706, #92400e)',
                       backgroundSize: '200% 200%',
                       animation: 'shimmer 3s ease-in-out infinite'
                     }}>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-yellow-300/60">
            <p className="font-['Press_Start_2P'] text-sm">No scores yet!</p>
            <p className="text-xs mt-2">Be the first to set a record!</p>
          </div>
        )}
      </div>

      {/* Player's current session info */}
      {currentPlayerAddress && (
        <div className="mt-4 p-3 bg-slate-900/40 rounded-lg border border-yellow-500/20 text-center">
          <p className="text-xs text-yellow-200 mb-1">Current Session</p>
          <p className="text-sm text-yellow-300 font-['Press_Start_2P']">
            Best: {myBestScore.toLocaleString()}
          </p>
          {currentScore > 0 && (
            <p className="text-xs text-green-400 mt-1">
              Current: {currentScore.toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiUserLeaderboard;
