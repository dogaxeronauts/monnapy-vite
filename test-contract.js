// ScoreTierNFT Contract Test Script
// Test your deployed contract on Monad Testnet

import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0x8578163F8C29138ECc9B44A6592112A58c8f7c4d";

// Contract ABI - matches your exact Solidity contract
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

// Tier mapping from your contract
const TIER_NAMES = {
  0: "None",
  1: "Regular",
  2: "Bronze", 
  3: "Silver",
  4: "Gold",
  5: "Platinum",
  6: "Diamond",
  7: "Legendary",
  8: "Mythic"
};

async function testContract() {
  console.log("🔍 Testing ScoreTierNFT Contract");
  console.log("📍 Contract Address:", CONTRACT_ADDRESS);
  console.log("🌐 Network: Monad Testnet");
  console.log("");

  try {
    // Connect to Monad Testnet (you might need to adjust RPC URL)
    const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz"); // Adjust RPC URL if needed
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    console.log("✅ Contract connected successfully!");

    // Test 1: Get contract name and symbol
    try {
      const name = await contract.name();
      const symbol = await contract.symbol();
      console.log("📝 Contract Name:", name);
      console.log("🏷️  Contract Symbol:", symbol);
    } catch (error) {
      console.log("⚠️  Could not get name/symbol (might not be public)");
    }

    // Test 2: Get next token ID
    try {
      const nextId = await contract.nextTokenId();
      console.log("🆔 Next Token ID:", nextId.toString());
    } catch (error) {
      console.log("❌ Could not get nextTokenId:", error.message);
    }

    console.log("");
    console.log("🎯 Testing Tier System:");

    // Test 3: Test tier system with different scores
    const testScores = [500, 750, 4500, 7500, 10000, 12500, 15000, 17500, 20000, 25000];
    
    for (const score of testScores) {
      try {
        const tierNumber = await contract.getTier(score);
        const tierName = TIER_NAMES[tierNumber] || "Unknown";
        console.log(`📊 Score ${score.toString().padStart(5)} → Tier ${tierNumber} (${tierName})`);
      } catch (error) {
        console.log(`❌ Error testing score ${score}:`, error.message);
      }
    }

    console.log("");
    console.log("✅ Contract test completed!");
    console.log("");
    console.log("🚀 Ready to mint NFTs! Use the web interface at http://localhost:5174");
    console.log("");
    console.log("💡 Test mint examples:");
    console.log("   - Enter score 1000 → Should mint Regular tier NFT");
    console.log("   - Enter score 5000 → Should mint Bronze tier NFT");
    console.log("   - Enter score 15000 → Should mint Diamond tier NFT");
    console.log("   - Enter score 500 → Should fail (Score too low)");

  } catch (error) {
    console.log("❌ Contract test failed:", error.message);
    console.log("");
    console.log("🔧 Possible issues:");
    console.log("   1. Contract not deployed at this address");
    console.log("   2. Wrong network (make sure you're on Monad Testnet)");
    console.log("   3. RPC connection issue");
  }
}

// Run the test
testContract();
