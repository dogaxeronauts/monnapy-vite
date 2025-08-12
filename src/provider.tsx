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
import { useEffect } from 'react';
import { config } from "./config";
import App from './App';

const queryClient = new QueryClient();

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />} />
  )
);

// Component to hide loading screens
const LoadingScreenHider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Function to hide loading screens
    const hideLoadingScreens = () => {
      // Hide Croquet spinner overlay
      const spinnerOverlay = document.getElementById('croquet_spinnerOverlay');
      if (spinnerOverlay) {
        spinnerOverlay.style.display = 'none';
      }

      // Hide any multisynq/croquet loading elements
      const loadingElements = document.querySelectorAll(
        '[id*="multisynq"], [class*="multisynq"], [id*="croquet"], [class*="croquet"], .croquet_loading, .multisynq_loading'
      );
      
      loadingElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.style.display = 'none';
          element.style.visibility = 'hidden';
          element.style.opacity = '0';
        }
      });
    };

    // Hide immediately
    hideLoadingScreens();

    // Set up observer to hide loading screens as they appear
    const observer = new MutationObserver(() => {
      hideLoadingScreens();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Also use interval as backup
    const interval = setInterval(hideLoadingScreens, 100);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return <>{children}</>;
};

export const Providers = () => {
  // Build-time injection - browser'da kaynak kodda görünmez
  const apiKey = __MULTISYNQ_API_KEY__;
  const sessionPassword = __REACT_TOGETHER_PASSWORD__;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <LoadingScreenHider>
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
          </LoadingScreenHider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
