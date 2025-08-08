import { useState } from "react";
import { ethers } from "ethers";
import { GAME_CONFIG } from "../config";

// ScoreTierNFT Contract ABI - Fixed to match actual contract
const ABI = [
  "function mint(uint256 score) external",
  "function getTier(uint256 score) external pure returns (uint8)", // Returns enum as uint8
  "function tokenTier(uint256 tokenId) external view returns (uint8)", // Returns enum as uint8
  "function nextTokenId() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)"
];

export default function MintNFT() {
  const [status, setStatus] = useState("");
  const [score, setScore] = useState("");
  const [loading, setLoading] = useState(false);

  // Add Monad Testnet to MetaMask
  const addMonadTestnet = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x279F', // 10143 in hex
            chainName: 'Monad Testnet',
            nativeCurrency: {
              name: 'MON',
              symbol: 'MON',
              decimals: 18,
            },
            rpcUrls: ['https://testnet-rpc.monad.xyz'],
            blockExplorerUrls: ['https://testnet-explorer.monad.xyz'],
          },
        ],
      });
      setStatus("✅ Monad Testnet added! Try again now.");
    } catch (error: any) {
      console.error('Failed to add network:', error);
      setStatus(`❌ Network could not be added: ${error.message}`);
    }
  };

  // Get tier name from score (matches contract enum exactly)
  const getTierName = (score: number) => {
    if (score >= 20000) return "Mythic";      // Tier.Mythic (8)
    if (score >= 17500) return "Legendary";   // Tier.Legendary (7)
    if (score >= 15000) return "Diamond";     // Tier.Diamond (6)
    if (score >= 12500) return "Platinum";    // Tier.Platinum (5)
    if (score >= 10000) return "Gold";        // Tier.Gold (4)
    if (score >= 7500) return "Silver";       // Tier.Silver (3)
    if (score >= 4500) return "Bronze";       // Tier.Bronze (2)
    if (score >= 750) return "Regular";       // Tier.Regular (1)
    return "None";                             // Tier.None (0)
  };

  // Get tier color for UI
  const getTierColor = (score: number) => {
    if (score >= 20000) return "#FF00FF"; // Mythic - Purple
    if (score >= 17500) return "#FFD700"; // Legendary - Gold
    if (score >= 15000) return "#B9F2FF"; // Diamond - Light Blue
    if (score >= 12500) return "#E5E4E2"; // Platinum - Silver
    if (score >= 10000) return "#FFD700"; // Gold - Gold
    if (score >= 7500) return "#C0C0C0";  // Silver - Silver
    if (score >= 4500) return "#CD7F32";  // Bronze - Bronze
    if (score >= 750) return "#10B981";   // Regular - Green
    return "#6B7280"; // None - Gray
  };

  async function handleMint() {
    if (!score || isNaN(Number(score))) {
      setStatus("Please enter a valid score!");
      return;
    }

    const scoreNumber = Number(score);
    
    if (scoreNumber < 750) {
      setStatus("Score must be at least 750!");
      return;
    }

    setLoading(true);
    setStatus("Minting process starting...");

    try {
      if (!window.ethereum) {
        setStatus("❌ Please install MetaMask!");
        setLoading(false);
        return;
      }

      // Request account access
      setStatus("🔐 Requesting wallet connection...");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();
      
      setStatus(`👤 Connected address: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
      
      // Check network
      const network = await provider.getNetwork();
      console.log("Current network:", network);
      
      if (network.chainId !== 10143n) {
        setStatus(`❌ Wrong network! Switch to Monad Testnet (Chain ID: 10143). Currently: ${network.chainId}`);
        setLoading(false);
        
        // Auto-suggest adding the network
        setTimeout(() => {
          if (window.confirm("Would you like to add Monad Testnet to MetaMask?")) {
            addMonadTestnet();
          }
        }, 1000);
        return;
      }
      
      setStatus("✅ Connected to Monad Testnet");
      
      // Check balance
      const balance = await provider.getBalance(userAddress);
      const balanceInMon = ethers.formatEther(balance);
      console.log("User balance:", balanceInMon, "MON");
      
      if (parseFloat(balanceInMon) < 0.01) {
        setStatus(`⚠️ Low balance: ${parseFloat(balanceInMon).toFixed(4)} MON. More MON may be needed for gas fees.`);
      }

      const contract = new ethers.Contract(GAME_CONFIG.CONTRACT_ADDRESS, ABI, signer);
      
      setStatus("🔍 Checking contract...");

      // Local tier calculation - matches contract enum exactly
      const getTierNameFromScore = (score: number) => {
        if (score >= 20000) return "Mythic";      // Tier.Mythic (8)
        if (score >= 17500) return "Legendary";   // Tier.Legendary (7)
        if (score >= 15000) return "Diamond";     // Tier.Diamond (6)
        if (score >= 12500) return "Platinum";    // Tier.Platinum (5)
        if (score >= 10000) return "Gold";        // Tier.Gold (4)
        if (score >= 7500) return "Silver";       // Tier.Silver (3)
        if (score >= 4500) return "Bronze";       // Tier.Bronze (2)
        if (score >= 750) return "Regular";       // Tier.Regular (1)
        return "None";                             // Tier.None (0)
      };

      const tierName = getTierNameFromScore(scoreNumber);

      // Try to get tier from contract, but fallback to local calculation
      let contractTierNumber = 0;
      try {
        setStatus("📊 Getting tier info from contract...");
        contractTierNumber = await contract.getTier(scoreNumber);
        console.log("Contract returned tier:", contractTierNumber);
        
        // Contract returns 0 for Tier.None (score too low)
        if (contractTierNumber === 0) {
          setStatus(`❌ Contract: Score too low! (Tier.None) Minimum 750 required.`);
          setLoading(false);
          return;
        }
        
        setStatus(`✅ Tier verified: ${tierName} (${contractTierNumber})`);
      } catch (contractError) {
        console.error("Contract getTier failed:", contractError);
        
        // Check if contract exists by trying to get code
        const code = await provider.getCode(GAME_CONFIG.CONTRACT_ADDRESS);
        if (code === "0x") {
          setStatus(`❌ Contract not found!\nAddress: ${GAME_CONFIG.CONTRACT_ADDRESS}\n\nContract may not be deployed.`);
          setLoading(false);
          return;
        }
        
        // Contract exists but getTier failed
        setStatus(`⚠️ getTier function not working, will still try to mint...`);
      }

      setStatus(`🎯 Minting ${tierName} tier NFT...`);
      
      // Estimate gas first
      try {
        const estimatedGas = await contract.mint.estimateGas(scoreNumber);
        console.log("Estimated gas:", estimatedGas.toString());
        setStatus(`⛽ Estimated gas: ${estimatedGas.toString()}`);
      } catch (gasError) {
        console.error("Gas estimation failed:", gasError);
        setStatus(`⚠️ Gas estimation failed, still trying...`);
      }

      try {
        // Mint NFT with the score
        setStatus("📝 Signing transaction...");
        const tx = await contract.mint(scoreNumber);
        setStatus(`🚀 Transaction sent!\nHash: ${tx.hash.slice(0, 10)}...`);
        
        // Wait for transaction confirmation
        setStatus("⏳ Waiting for confirmation...");
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          setStatus(`🎉 ${tierName} NFT successfully minted!\n\nTx: ${tx.hash}`);
          
          // Clear the score input
          setScore("");
          
          // Try to get the token ID from events
          try {
            const transferEvents = receipt.logs.filter((log: any) => 
              log.topics[0] === ethers.id("Transfer(address,address,uint256)")
            );
            if (transferEvents.length > 0) {
              const tokenId = ethers.AbiCoder.defaultAbiCoder().decode(
                ["uint256"], 
                transferEvents[0].topics[3]
              )[0];
              setStatus(prev => prev + `\n🆔 Token ID: ${tokenId.toString()}`);
            }
          } catch (eventError) {
            console.log("Could not parse token ID from events:", eventError);
          }
        } else {
          setStatus(`❌ Transaction failed! Status: ${receipt.status}`);
        }
      } catch (mintError: any) {
        console.error("Mint failed:", mintError);
        
        if (mintError.code === 4001) {
          setStatus("❌ Transaction cancelled by user.");
        } else if (mintError.message.includes("Score too low")) {
          setStatus("❌ Contract error: Score too low!");
        } else if (mintError.message.includes("execution reverted")) {
          setStatus(`❌ Contract error: Transaction reverted.\n\nDetail: ${mintError.reason || mintError.message}`);
        } else if (mintError.message.includes("insufficient funds")) {
          setStatus("❌ Insufficient balance! More MON needed for gas fees.");
        } else if (mintError.message.includes("gas")) {
          setStatus(`❌ Gas error: ${mintError.message}`);
        } else {
          setStatus(`❌ Mint error: ${mintError.message}`);
        }
      }

    } catch (err: any) {
      console.error("General mint error:", err);
      
      if (err.code === 4001) {
        setStatus("❌ Transaction cancelled by user.");
      } else if (err.message.includes("could not decode result data")) {
        setStatus("❌ Contract ABI error! Contract function not found.");
      } else if (err.message.includes("user rejected")) {
        setStatus("❌ Transaction rejected by user.");
      } else if (err.message.includes("network")) {
        setStatus(`❌ Network error: ${err.message}`);
      } else {
        setStatus(`❌ General error: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScore(value);
    
    // Show tier preview if valid score
    if (value && !isNaN(Number(value))) {
      const scoreNum = Number(value);
      const tierName = getTierName(scoreNum);
      if (tierName !== "None") {
        setStatus(`Preview: ${tierName} tier (${scoreNum} points)`);
      } else {
        setStatus("At least 750 points required");
      }
    } else {
      setStatus("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl border border-purple-500/30 shadow-2xl max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          🎮 ScoreTierNFT Mint
        </h1>
        
        <div className="space-y-6">
          {/* Score Input */}
          <div>
            <label className="block text-purple-300 text-sm font-medium mb-2">
              Enter Your Score
            </label>
            <input
              type="number"
              placeholder="Minimum 750 points"
              value={score}
              onChange={handleScoreChange}
              className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading}
              min="0"
              step="1"
            />
          </div>

          {/* Tier Preview */}
          {score && !isNaN(Number(score)) && Number(score) >= 750 && (
            <div className="p-4 bg-slate-700 rounded-lg border border-purple-500/20">
              <h3 className="text-sm font-medium text-purple-300 mb-2">NFT Preview</h3>
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: getTierColor(Number(score)) }}
                ></div>
                <span className="text-white font-medium">
                  {getTierName(Number(score))} Tier
                </span>
              </div>
              <p className="text-slate-300 text-sm mt-1">
                Score: {score} points
              </p>
            </div>
          )}

          {/* Mint Button */}
          <button
            onClick={handleMint}
            disabled={loading || !score || Number(score) < 750}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
              loading || !score || Number(score) < 750
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 shadow-lg'
            }`}
          >
            {loading ? 'Minting...' : 'Mint NFT'}
          </button>

          {/* Status Display */}
          {status && (
            <div className={`p-4 rounded-lg border ${
              status.includes('Error') || status.includes('low') || status.includes('❌') 
                ? 'bg-red-900/30 border-red-500/30 text-red-300'
                : status.includes('successfully') || status.includes('🎉')
                ? 'bg-green-900/30 border-green-500/30 text-green-300'
                : 'bg-blue-900/30 border-blue-500/30 text-blue-300'
            }`}>
              <p className="text-sm break-words">{status}</p>
            </div>
          )}

          {/* Tier Requirements Info */}
          <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600/30">
            <h3 className="text-sm font-medium text-purple-300 mb-3">Tier Requirements</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-300">Regular:</span>
                <span className="text-green-400">750+ points</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Bronze:</span>
                <span className="text-yellow-600">4,500+ points</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Silver:</span>
                <span className="text-gray-400">7,500+ points</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Gold:</span>
                <span className="text-yellow-400">10,000+ points</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Platinum:</span>
                <span className="text-gray-300">12,500+ points</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Diamond:</span>
                <span className="text-blue-300">15,000+ points</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Legendary:</span>
                <span className="text-yellow-300">17,500+ points</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Mythic:</span>
                <span className="text-purple-400">20,000+ points</span>
              </div>
            </div>
          </div>

          {/* Contract Info */}
          <div className="text-center space-y-2">
            <p className="text-xs text-slate-400">
              Contract: {GAME_CONFIG.CONTRACT_ADDRESS.slice(0, 6)}...{GAME_CONFIG.CONTRACT_ADDRESS.slice(-4)}
            </p>
            <div className="flex justify-center space-x-4 text-xs text-slate-500">
              <span>Network: Monad Testnet</span>
              <span>Chain ID: 10143</span>
            </div>
            <button
              onClick={addMonadTestnet}
              className="text-xs text-purple-400 hover:text-purple-300 underline"
            >
              + Add Monad Testnet to MetaMask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
