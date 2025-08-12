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
  // Use production API key in production, development key in development
  const apiKey = import.meta.env.PROD 
    ? import.meta.env.VITE_MULTISYNQ_API_KEY_PROD || import.meta.env.VITE_MULTISYNQ_API_KEY
    : import.meta.env.VITE_MULTISYNQ_API_KEY;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <ReactTogether
            sessionParams={{
              appId: 'io.multisynq.monnapy.flappybird',
              apiKey: apiKey || 'your-api-key-here',
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
