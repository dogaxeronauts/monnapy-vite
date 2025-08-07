import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import FlappyBird from "./components/FlappyBird";

export default function App() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ConnectKit Button - Fixed position with high z-index */}
      <div className="fixed top-4 right-4 z-50">
        <ConnectKitButton />
      </div>
      
      <main className="w-full">
        <div className="flex flex-col items-center justify-center min-h-screen">
          {isConnected ? (
            <FlappyBird />
          ) : (
            <div className="text-center p-8 bg-purple-900/20 rounded-lg border border-purple-500/30 backdrop-blur-sm">
              <h2 className="text-xl font-bold mb-4 text-purple-300">Welcome to MONAPY!</h2>
              <p className="text-purple-200">Please connect your wallet to start playing Flappy Bird!</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}