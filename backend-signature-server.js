// Backend API endpoint for game signature generation
// Bu dosyayı backend sunucunuzda /api/get-mint-signature endpoint'i olarak kullanın

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
const getTierNumber = (score) => {
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
const getTierBoundaries = (tierNumber) => {
  const boundaries = [
    { min: 20000, max: Number.MAX_SAFE_INTEGER }, // Mythic
    { min: 17500, max: 20000 },                   // Legendary
    { min: 15000, max: 17500 },                   // Diamond  
    { min: 12500, max: 15000 },                   // Platinum
    { min: 10000, max: 12500 },                   // Gold
    { min: 7500, max: 10000 },                    // Silver
    { min: 4500, max: 7500 },                     // Bronze
    { min: 750, max: 4500 }                       // Regular
  ];
  
  return boundaries[tierNumber] || null;
};

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

app.post('/api/get-mint-signature', async (req, res) => {
  try {
    const { playerAddress, tierNumber, finalScore, gameSessionId, timestamp } = req.body;
    
    // Input validation
    if (!playerAddress || typeof tierNumber !== 'number' || typeof finalScore !== 'number') {
      return res.status(400).json({ error: 'Invalid input parameters' });
    }
    
    // Validate Ethereum address
    if (!ethers.isAddress(playerAddress)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }
    
    // Rate limiting
    if (!checkRateLimit(playerAddress)) {
      return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
    }
    
    // Validate timestamp (should be recent, within last 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (!timestamp || Math.abs(now - timestamp) > 300) {
      return res.status(400).json({ error: 'Request timestamp is invalid or too old' });
    }
    
    // Validate tier number
    if (tierNumber < 0 || tierNumber > 7) {
      return res.status(400).json({ error: 'Invalid tier number' });
    }
    
    // Validate score matches the requested tier
    const expectedTier = getTierNumber(finalScore);
    if (expectedTier !== tierNumber) {
      return res.status(400).json({ 
        error: `Score ${finalScore} does not match tier ${tierNumber}. Expected tier: ${expectedTier}` 
      });
    }
    
    // Additional validation: Score must be within tier boundaries
    const boundaries = getTierBoundaries(tierNumber);
    if (!boundaries || finalScore < boundaries.min || finalScore >= boundaries.max) {
      return res.status(400).json({ 
        error: `Score ${finalScore} is not within valid range for tier ${tierNumber}` 
      });
    }
    
    // Minimum score requirement
    if (finalScore < 750) {
      return res.status(400).json({ error: 'Score too low for any NFT tier' });
    }
    
    // Create the message to sign (same format as smart contract expects)
    // This must match exactly with the smart contract's verification
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ["address", "uint256"],
        [playerAddress, tierNumber]
      )
    );
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(GAME_SIGNER_PRIVATE_KEY);
    
    // Sign the message hash (this creates the signature the smart contract expects)
    const signature = await wallet.signMessage(ethers.getBytes(messageHash));
    
    console.log(`Generated signature for ${playerAddress}, tier ${tierNumber}, score ${finalScore}`);
    
    // Log for monitoring/debugging
    console.log({
      timestamp: new Date().toISOString(),
      playerAddress,
      tierNumber,
      finalScore,
      gameSessionId,
      signerAddress: wallet.address
    });
    
    res.json({ 
      signature,
      signerAddress: wallet.address,
      message: `Signature generated for tier ${tierNumber} NFT`,
      expires: timestamp + 300 // Signature expires in 5 minutes
    });
    
  } catch (error) {
    console.error('Error generating signature:', error);
    res.status(500).json({ error: 'Internal server error' });
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
