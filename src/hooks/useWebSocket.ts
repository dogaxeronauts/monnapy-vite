import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { GAME_CONFIG } from '../config';

export interface LeaderboardEntry {
  address: string;
  score: number;
  timestamp: number;
  tier: string;
  isOnline?: boolean;
}

export interface LiveScoreUpdate {
  address: string;
  score: number;
  tier: string;
  timestamp: number;
}

interface UseWebSocketReturn {
  leaderboard: LeaderboardEntry[];
  onlineCount: number;
  isConnected: boolean;
  submitScore: (address: string, score: number, tier: string) => void;
  reconnect: () => void;
  onScoreUpdate?: (callback: (update: LiveScoreUpdate) => void) => void;
  onPlayerJoin?: (callback: (data: { address: string; count: number }) => void) => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const scoreUpdateCallbackRef = useRef<((update: LiveScoreUpdate) => void) | null>(null);
  const playerJoinCallbackRef = useRef<((data: { address: string; count: number }) => void) | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    // Clear any existing connection
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    socketRef.current = io(GAME_CONFIG.BACKEND_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true,
    });

    const socket = socketRef.current;

    // Connection events
    socket.on('connect', () => {
      console.log('🔗 Connected to live leaderboard');
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from live leaderboard');
      setIsConnected(false);
      
      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        connect();
      }, 3000);
    });

    socket.on('connect_error', (error: Error) => {
      console.log('🚫 Connection error:', error.message);
      setIsConnected(false);
    });

    // Leaderboard events
    socket.on('leaderboard_update', (data: LeaderboardEntry[]) => {
      setLeaderboard(data);
    });

    socket.on('live_score_update', (update: LiveScoreUpdate) => {
      setLeaderboard(prev => {
        const updated = [...prev];
        const existingIndex = updated.findIndex(entry => entry.address === update.address);
        
        if (existingIndex >= 0) {
          // Update existing player
          updated[existingIndex] = {
            ...updated[existingIndex],
            score: update.score,
            tier: update.tier,
            timestamp: update.timestamp,
            isOnline: true
          };
        } else {
          // Add new player
          updated.push({
            address: update.address,
            score: update.score,
            tier: update.tier,
            timestamp: update.timestamp,
            isOnline: true
          });
        }
        
        // Sort by score and keep top 15
        return updated
          .sort((a, b) => b.score - a.score)
          .slice(0, 15);
      });

      // Trigger callback if set
      if (scoreUpdateCallbackRef.current) {
        scoreUpdateCallbackRef.current(update);
      }
    });

    socket.on('player_joined', (data: { count: number; address: string }) => {
      setOnlineCount(data.count);
      console.log(`🎮 Player joined: ${data.address} (${data.count} online)`);
      
      // Trigger callback if set
      if (playerJoinCallbackRef.current) {
        playerJoinCallbackRef.current(data);
      }
    });

    socket.on('player_left', (data: { count: number; address: string }) => {
      setOnlineCount(data.count);
      console.log(`👋 Player left: ${data.address} (${data.count} online)`);
      
      // Mark player as offline in leaderboard
      setLeaderboard(prev => 
        prev.map(entry => 
          entry.address === data.address 
            ? { ...entry, isOnline: false }
            : entry
        )
      );
    });

    socket.on('online_count', (count: number) => {
      setOnlineCount(count);
    });

  }, []);

  const submitScore = useCallback((address: string, score: number, tier: string) => {
    if (socketRef.current?.connected) {
      // If this is the first submission (score 0), send player_join instead
      if (score === 0) {
        socketRef.current.emit('player_join', { address });
      } else {
        socketRef.current.emit('submit_score', {
          address,
          score,
          tier,
          timestamp: Date.now()
        });
      }
    }
  }, []);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  const onScoreUpdate = useCallback((callback: (update: LiveScoreUpdate) => void) => {
    scoreUpdateCallbackRef.current = callback;
  }, []);

  const onPlayerJoin = useCallback((callback: (data: { address: string; count: number }) => void) => {
    playerJoinCallbackRef.current = callback;
  }, []);

  useEffect(() => {
    connect();

    // Expose socket to window for component access
    const connectToSocket = () => {
      if (socketRef.current) {
        (window as any).socket = socketRef.current;
      }
    };

    // Set up socket after connection
    const checkConnection = setInterval(() => {
      if (socketRef.current?.connected) {
        connectToSocket();
        clearInterval(checkConnection);
      }
    }, 100);

    return () => {
      clearInterval(checkConnection);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      delete (window as any).socket;
    };
  }, [connect]);

  return {
    leaderboard,
    onlineCount,
    isConnected,
    submitScore,
    reconnect,
    onScoreUpdate,
    onPlayerJoin
  };
};
