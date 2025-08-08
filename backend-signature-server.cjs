// Backend API endpoint for game signature generation
// Updated for new TieredNFT contract logic

const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// GAME SIGNER PRIVATE KEY - GÜVENLI BİR YERDE SAKLAYIN!
// Bu private key'i .env dosyasında tutun ve asla git'e commitlemeyin!
const GAME_SIGNER_PRIVATE_KEY = process.env.GAME_SIGNER_PRIVATE_KEY;

if (!GAME_SIGNER_PRIVATE_KEY) {
  throw new Error("GAME_SIGNER_PRIVATE_KEY environment variable is required!");
}

// Smart contract tier requirements (frontend ile aynı olmalı)
const getTierFromScore = (score) => {
  if (score >= 20000) return 0; // Mythic
  if (score >= 17500) return 1; // Legendary  
  if (score >= 15000) return 2; // Diamond
  if (score >= 12500) return 3; // Platinum
  if (score >= 10000) return 4; // Gold
  if (score >= 7500) return 5;  // Silver
  if (score >= 4500) return 6;  // Bronze
  if (score >= 750) return 7;   // Regular
  return -1; // Invalid
};

// Tier boundaries for validation
const tiers = [
  { minScore: 20000, maxScore: Number.MAX_SAFE_INTEGER }, // Mythic
  { minScore: 17500, maxScore: 20000 },                   // Legendary
  { minScore: 15000, maxScore: 17500 },                   // Diamond  
  { minScore: 12500, maxScore: 15000 },                   // Platinum
  { minScore: 10000, maxScore: 12500 },                   // Gold
  { minScore: 7500, maxScore: 10000 },                    // Silver
  { minScore: 4500, maxScore: 7500 },                     // Bronze
  { minScore: 750, maxScore: 4500 }                       // Regular
];

// Rate limiting to prevent abuse
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

const checkRateLimit = (address) => {
  const now = Date.now();
  const userRequests = rateLimitMap.get(address) || [];
  
  // Remove old requests outside the window
  const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(address, recentRequests);
  return true;
};

// Main signature endpoint for tier minting
app.post('/api/get-signature', async (req, res) => {
  try {
    const { address, score } = req.body;
    
    // Input validation
    if (!address || typeof score !== 'number') {
      return res.status(400).json({ error: 'Invalid input parameters' });
    }
    
    // Validate Ethereum address
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Rate limiting
    if (!checkRateLimit(address)) {
      return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    }
    
    // Validate score
    if (score < 750) {
      return res.status(400).json({ error: 'Score too low for any NFT tier' });
    }
    
    // Get tier for this score
    const tierIndex = getTierFromScore(score);
    if (tierIndex === -1) {
      return res.status(400).json({ error: 'Invalid score for any tier' });
    }
    
    // Additional validation: Score must be within tier boundaries
    const tier = tiers[tierIndex];
    if (score < tier.minScore || score >= tier.maxScore) {
      return res.status(400).json({ 
        error: `Score ${score} is not within valid range for tier ${tierIndex}` 
      });
    }
    
    // Create the message hash (same format as smart contract expects)
    // For regular tier minting: keccak256(abi.encodePacked(address, score))
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256"],
        [address, score]
      )
    );
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(GAME_SIGNER_PRIVATE_KEY);
    
    // Sign the message hash using ethers.js signMessage (this handles the "\x19Ethereum Signed Message:\n32" prefix)
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    console.log(`Generated signature for ${address}, score ${score}, tier ${tierIndex}`);
    
    // Log for monitoring/debugging
    console.log({
      timestamp: new Date().toISOString(),
      address,
      score,
      tierIndex,
      signerAddress: wallet.address
    });
    
    res.json({ 
      signature,
      tierIndex,
      signerAddress: wallet.address,
      message: `Signature generated for tier ${tierIndex} NFT`
    });
    
  } catch (error) {
    console.error('Error generating signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Achievement signature endpoint
app.post('/api/get-achievement-signature', async (req, res) => {
  try {
    const { address, score } = req.body;
    
    // Input validation
    if (!address || typeof score !== 'number') {
      return res.status(400).json({ error: 'Invalid input parameters' });
    }
    
    // Validate Ethereum address
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Rate limiting
    if (!checkRateLimit(address)) {
      return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    }
    
    // Achievement requires score >= 10000
    if (score < 10000) {
      return res.status(400).json({ error: 'Score too low for achievement NFT. Need 10000+' });
    }
    
    // Create the message hash for achievement (same format as smart contract expects)
    // For achievement minting: keccak256(abi.encodePacked(address, score, "ACHIEVEMENT"))
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256", "string"],
        [address, score, "ACHIEVEMENT"]
      )
    );
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(GAME_SIGNER_PRIVATE_KEY);
    
    // Sign the message hash
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    console.log(`Generated achievement signature for ${address}, score ${score}`);
    
    // Log for monitoring/debugging
    console.log({
      timestamp: new Date().toISOString(),
      address,
      score,
      type: 'ACHIEVEMENT',
      signerAddress: wallet.address
    });
    
    res.json({ 
      signature,
      signerAddress: wallet.address,
      message: `Achievement signature generated for score ${score}`
    });
    
  } catch (error) {
    console.error('Error generating achievement signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// In-memory leaderboard storage (use database in production)
let leaderboard = [];

// POST /api/leaderboard - Submit score to leaderboard
app.post('/api/leaderboard', (req, res) => {
  try {
    const { address, score, timestamp, tier } = req.body;
    
    // Validate input
    if (!address || !score || !timestamp || !tier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate Ethereum address
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Validate score
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }
    
    // Check if user already has a better score
    const existingEntryIndex = leaderboard.findIndex(entry => entry.address.toLowerCase() === address.toLowerCase());
    
    if (existingEntryIndex !== -1) {
      // Update if new score is better
      if (score > leaderboard[existingEntryIndex].score) {
        leaderboard[existingEntryIndex] = { address, score, timestamp, tier };
      }
    } else {
      // Add new entry
      leaderboard.push({ address, score, timestamp, tier });
    }
    
    // Sort by score (highest first) and keep only top 100
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 100);
    
    res.json({ success: true, message: 'Score submitted successfully' });
    
  } catch (error) {
    console.error('Leaderboard submission error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// GET /api/leaderboard - Get top scores
app.get('/api/leaderboard', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const topScores = leaderboard.slice(0, Math.min(limit, 100));
    
    res.json(topScores);
    
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: Date.now() });
});

// Get game signer address (for debugging)
app.get('/api/game-signer', (req, res) => {
  const wallet = new ethers.Wallet(GAME_SIGNER_PRIVATE_KEY);
  res.json({ signerAddress: wallet.address });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Game signature server running on port ${PORT}`);
  
  // Log the signer address for contract setup
  const wallet = new ethers.Wallet(GAME_SIGNER_PRIVATE_KEY);
  console.log(`Game signer address: ${wallet.address}`);
  console.log('Make sure to set this address in your smart contract using setGameSigner()');
});

module.exports = app;
