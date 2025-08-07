import { http, createConfig } from "wagmi";
import { monadTestnet } from "wagmi/chains";

export const config = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
});

// Game Backend Configuration
export const GAME_CONFIG = {
  // Backend URL for signature generation
  // Change this to your deployed backend URL
  BACKEND_URL: process.env.NODE_ENV === 'production' 
    ? 'https://your-production-backend.com' 
    : 'http://localhost:3001',
  
  // Smart contract address
  CONTRACT_ADDRESS: "0x8b25528419C36e7fA7b7Cf20272b65Ba41Fca8C4",
  
  // Game settings
  MIN_SCORE_FOR_NFT: 750,
  SIGNATURE_TIMEOUT: 300, // 5 minutes in seconds
};