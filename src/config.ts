import { http, createConfig } from "wagmi";
import { monadTestnet } from "wagmi/chains";

export const config = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
});

export const GAME_CONFIG = {
  BACKEND_URL: process.env.NODE_ENV === 'production' 
    ? 'https://your-backend-url.com' 
    : 'http://localhost:3001',
  CONTRACT_ADDRESS: '0x8b25528419C36e7fA7b7Cf20272b65Ba41Fca8C4',
};