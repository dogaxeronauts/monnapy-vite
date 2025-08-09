const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory leaderboard storage
let leaderboard = [];

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topScores = leaderboard.slice(0, limit);
    res.json(topScores);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Submit score to leaderboard
app.post('/api/leaderboard', (req, res) => {
  try {
    const { address, score, timestamp, tier } = req.body;

    if (!address || typeof score !== 'number') {
      return res.status(400).json({ error: 'Invalid data' });
    }

    // Check if player already exists
    const existingIndex = leaderboard.findIndex(entry => 
      entry.address.toLowerCase() === address.toLowerCase()
    );

    if (existingIndex !== -1) {
      // Update if new score is higher
      if (score > leaderboard[existingIndex].score) {
        leaderboard[existingIndex] = { address, score, timestamp, tier };
      }
    } else {
      // Add new entry
      leaderboard.push({ address, score, timestamp, tier });
    }

    // Sort by score (highest first) and keep top 100
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 100);

    const rank = leaderboard.findIndex(entry => 
      entry.address.toLowerCase() === address.toLowerCase()
    ) + 1;

    res.json({ success: true, rank });
  } catch (error) {
    console.error('Error submitting to leaderboard:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// Get player specific data
app.get('/api/leaderboard/player/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    const playerIndex = leaderboard.findIndex(entry => 
      entry.address.toLowerCase() === address.toLowerCase()
    );

    if (playerIndex === -1) {
      return res.json({ rank: null, score: 0 });
    }

    const playerEntry = leaderboard[playerIndex];
    res.json({
      rank: playerIndex + 1,
      score: playerEntry.score,
      tier: playerEntry.tier
    });
  } catch (error) {
    console.error('Error fetching player data:', error);
    res.status(500).json({ error: 'Failed to fetch player data' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Leaderboard Backend Server running on port ${PORT}`);
  console.log(`📊 Leaderboard API: http://localhost:${PORT}/api/leaderboard`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
});
