"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { WagmiProvider } from "wagmi";
import { 
  createBrowserRouter, 
  RouterProvider,
  createRoutesFromElements,
  Route 
} from 'react-router-dom';
import { ReactTogether } from 'react-together';
import { config } from "./config";
import App from './App';

const queryClient = new QueryClient();

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />} />
  )
);

export const Providers = () => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <ReactTogether
            sessionParams={{
              appId: 'io.multisynq.monnapy.flappybird',
              apiKey: import.meta.env.VITE_MULTISYNQ_API_KEY || 'your-api-key-here', // Get from https://multisynq.io/coder
              name: 'flappy-bird-global-leaderboard',
              password: 'monnapy2024'
            }}
            rememberUsers={true}
          >
            <RouterProvider router={router} />
          </ReactTogether>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
