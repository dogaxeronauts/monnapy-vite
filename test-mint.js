// NFT Mint Test Script
// Test the complete mint flow

import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x8578163F8C29138ECc9B44A6592112A58c8f7c4d";
const RPC_URL = "https://testnet-rpc.monad.xyz";

// Contract ABI
const ABI = [
  "function mint(uint256 score) external",
  "function getTier(uint256 score) external pure returns (uint8)",
  "function tokenTier(uint256 tokenId) external view returns (uint8)",
  "function nextTokenId() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)"
];

async function testMintFlow() {
  console.log("🔍 Testing NFT Mint Flow");
  console.log("📍 Contract Address:", CONTRACT_ADDRESS);
  console.log("");

  try {
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    console.log("✅ Provider connected");

    // Test 1: Check contract basic info
    try {
      const name = await contract.name();
      const symbol = await contract.symbol();
      const nextId = await contract.nextTokenId();
      
      console.log("📝 Contract Name:", name);
      console.log("🏷️  Contract Symbol:", symbol);
      console.log("🆔 Next Token ID:", nextId.toString());
      console.log("");
    } catch (error) {
      console.log("❌ Basic contract info failed:", error.message);
      return;
    }

    // Test 2: Test getTier function with various scores
    console.log("🎯 Testing getTier function:");
    const testScores = [750, 1000, 5000, 15000];
    
    for (const score of testScores) {
      try {
        const tier = await contract.getTier(score);
        console.log(`✅ Score ${score} → Tier ${tier}`);
      } catch (error) {
        console.log(`❌ getTier(${score}) failed:`, error.message);
      }
    }
    console.log("");

    // Test 3: Test lower boundary (should fail)
    console.log("🚫 Testing invalid score (should return tier 0):");
    try {
      const tier = await contract.getTier(500);
      console.log(`Score 500 → Tier ${tier} (Should be 0 for None)`);
    } catch (error) {
      console.log("❌ getTier(500) failed:", error.message);
    }
    console.log("");

    console.log("✅ Contract testing completed!");
    console.log("");
    console.log("🔧 Troubleshooting NFT Mint Issues:");
    console.log("1. Make sure MetaMask is connected to Monad Testnet");
    console.log("2. Ensure you have enough MON tokens for gas fees");
    console.log("3. Try with a score >= 750");
    console.log("4. Check browser console for detailed error messages");
    console.log("");
    console.log("📋 Network Details:");
    console.log("   Network Name: Monad Testnet");
    console.log("   RPC URL: https://testnet-rpc.monad.xyz");
    console.log("   Chain ID: 41144");
    console.log("   Currency Symbol: MON");

  } catch (error) {
    console.log("❌ Test failed:", error.message);
  }
}

// Also test backend API
async function testBackendAPI() {
  console.log("");
  console.log("🔍 Testing Backend API:");
  
  try {
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:3001/api/health');
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log("✅ Backend health:", health.status);
    } else {
      console.log("❌ Backend health check failed");
      return;
    }

    // Test leaderboard get
    const leaderboardResponse = await fetch('http://localhost:3001/api/leaderboard');
    if (leaderboardResponse.ok) {
      const leaderboard = await leaderboardResponse.json();
      console.log("✅ Leaderboard endpoint working, entries:", leaderboard.length);
    } else {
      console.log("❌ Leaderboard get failed");
    }

    // Test leaderboard post
    const testScore = {
      address: "0x742d35Cc6634C0532925a3b8D72A34c7b4f4e123",
      score: 1500,
      timestamp: Date.now(),
      tier: "Bronze"
    };

    const postResponse = await fetch('http://localhost:3001/api/leaderboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testScore),
    });

    if (postResponse.ok) {
      const result = await postResponse.json();
      console.log("✅ Leaderboard submit working, rank:", result.rank);
    } else {
      console.log("❌ Leaderboard submit failed");
    }

  } catch (error) {
    console.log("❌ Backend API test failed:", error.message);
  }
}

// Run tests
testMintFlow();
testBackendAPI();
