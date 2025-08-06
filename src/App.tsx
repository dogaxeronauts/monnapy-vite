import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import FlappyBird from "./components/FlappyBird";

export default function App() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-4">
          <ConnectKitButton />
          {isConnected ? (
            <FlappyBird />
          ) : (
            <div className="text-center p-4 bg-purple-900/20 rounded-lg">
              Please connect your wallet to play Flappy Bird!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}