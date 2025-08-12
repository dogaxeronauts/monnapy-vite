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
  // Build-time injection - browser'da kaynak kodda görünmez
  const apiKey = __MULTISYNQ_API_KEY__;
  const sessionPassword = __REACT_TOGETHER_PASSWORD__;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <ReactTogether
            sessionParams={{
              appId: 'io.multisynq.monnapy.flappybird',
              apiKey: apiKey || 'your-api-key-here',
              name: 'flappy-bird-global-leaderboard',
              password: sessionPassword
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
