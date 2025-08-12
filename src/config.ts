import { http, createConfig } from "wagmi";
import { monadTestnet } from "wagmi/chains";

export const config = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(),
  },
});

export const GAME_CONFIG = {
  CONTRACT_ADDRESS: '0x8578163F8C29138ECc9B44A6592112A58c8f7c4d' // Update this with your actual deployed contract address
};