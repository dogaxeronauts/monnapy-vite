const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Socket.io configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-frontend-domain.com'] 
      : ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// In-memory data storage
let leaderboard = [];
let onlinePlayers = new Map(); // address -> socket.id
let playerSockets = new Map(); // socket.id -> player data

// Leaderboard management
const updateLeaderboard = (address, score, tier) => {
  const timestamp = Date.now();
  const existingIndex = leaderboard.findIndex(entry => entry.address === address);
  
  if (existingIndex >= 0) {
    // Update existing entry only if score is higher
    if (score > leaderboard[existingIndex].score) {
      leaderboard[existingIndex] = { address, score, tier, timestamp, isOnline: true };
    }
  } else {
    // Add new entry
    leaderboard.push({ address, score, tier, timestamp, isOnline: true });
  }
  
  // Sort by score and keep top 15
  leaderboard = leaderboard
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
    
  return leaderboard;
};

const broadcastLeaderboard = () => {
  io.emit('leaderboard_update', leaderboard);
};

const broadcastOnlineCount = () => {
  io.emit('online_count', onlinePlayers.size);
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔗 New connection: ${socket.id}`);
  
  // Send current leaderboard and online count to new connection
  socket.emit('leaderboard_update', leaderboard);
  socket.emit('online_count', onlinePlayers.size);
  
  // Handle player join
  socket.on('player_join', (data) => {
    const { address } = data;
    
    // Remove player from previous socket if exists
    if (onlinePlayers.has(address)) {
      const oldSocketId = onlinePlayers.get(address);
      playerSockets.delete(oldSocketId);
    }
    
    // Add player to current socket
    onlinePlayers.set(address, socket.id);
    playerSockets.set(socket.id, { address, joinTime: Date.now() });
    
    // Mark player as online in leaderboard
    const playerEntry = leaderboard.find(entry => entry.address === address);
    if (playerEntry) {
      playerEntry.isOnline = true;
    }
    
    // Broadcast player joined
    io.emit('player_joined', { count: onlinePlayers.size, address });
    broadcastLeaderboard();
    
    console.log(`🎮 Player joined: ${address} (${onlinePlayers.size} online)`);
  });
  
  // Handle score submission
  socket.on('submit_score', (data) => {
    const { address, score, tier } = data;
    const playerData = playerSockets.get(socket.id);
    
    // Verify the socket belongs to the address (basic security)
    if (!playerData || playerData.address !== address) {
      console.log(`🚫 Score submission denied: address mismatch for ${socket.id}`);
      return;
    }
    
    // Rate limiting: max 1 score per second per player
    const now = Date.now();
    if (playerData.lastScoreTime && now - playerData.lastScoreTime < 1000) {
      console.log(`⏰ Rate limited: ${address}`);
      return;
    }
    playerData.lastScoreTime = now;
    
    // Update leaderboard
    const updatedLeaderboard = updateLeaderboard(address, score, tier);
    
    // Broadcast live score update
    io.emit('live_score_update', {
      address,
      score,
      tier,
      timestamp: now
    });
    
    // Broadcast updated leaderboard
    broadcastLeaderboard();
    
    console.log(`📊 Score updated: ${address} - ${score} (${tier})`);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    const playerData = playerSockets.get(socket.id);
    
    if (playerData) {
      const { address } = playerData;
      
      // Remove from online players
      onlinePlayers.delete(address);
      playerSockets.delete(socket.id);
      
      // Mark as offline in leaderboard
      const playerEntry = leaderboard.find(entry => entry.address === address);
      if (playerEntry) {
        playerEntry.isOnline = false;
      }
      
      // Broadcast player left
      io.emit('player_left', { count: onlinePlayers.size, address });
      broadcastLeaderboard();
      
      console.log(`👋 Player left: ${address} (${onlinePlayers.size} online)`);
    }
    
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// REST API endpoints (for backward compatibility)
app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard);
});

app.post('/api/leaderboard', (req, res) => {
  const { address, score, tier } = req.body;
  
  if (!address || typeof score !== 'number' || !tier) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  updateLeaderboard(address, score, tier);
  broadcastLeaderboard();
  
  res.json({ success: true, leaderboard });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    onlinePlayers: onlinePlayers.size,
    leaderboardSize: leaderboard.length,
    timestamp: Date.now()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Live Leaderboard Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('💀 Process terminated');
    process.exit(0);
  });
});
