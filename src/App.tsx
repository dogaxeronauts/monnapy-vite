import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import FlappyBird from "./components/FlappyBird";

export default function App() {
  const { isConnected } = useAccount();

  if (isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4">
            <ConnectKitButton.Custom>
              {({ isConnected, show, truncatedAddress, ensName }) => {
                return (
                  <button 
                    onClick={show}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 border-2 border-purple-500/30 hover:border-purple-400/50 shadow-lg hover:shadow-purple-500/25"
                  >
                    {isConnected ? (ensName ?? truncatedAddress) : "Connect Wallet"}
                  </button>
                );
              }}
            </ConnectKitButton.Custom>
            <FlappyBird />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-1 h-1 bg-purple-400 rounded-full animate-ping"></div>
        <div className="absolute bottom-32 left-1/4 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-indigo-400 rounded-full animate-ping"></div>
        <div className="absolute bottom-1/4 right-10 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
      </div>

      <main className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/monad_logo.png" alt="Monad" className="w-10 h-10" />
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent">
                Monapy
              </span>
            </div>
            <ConnectKitButton.Custom>
              {({ isConnected, show, truncatedAddress, ensName }) => {
                return (
                  <button 
                    onClick={show}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 border-2 border-purple-500/30 hover:border-purple-400/50 shadow-lg hover:shadow-purple-500/25"
                  >
                    {isConnected ? (ensName ?? truncatedAddress) : "Connad Wallet"}
                  </button>
                );
              }}
            </ConnectKitButton.Custom>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 container mx-auto px-4 flex flex-col items-center justify-center text-center">
          <div className="max-w-4xl mx-auto">
            {/* Hero section */}
            <div className="mb-8">
              <img 
                src="/hedgehog.png" 
                alt="Hedgehog" 
                className="w-32 h-32 mx-auto mb-6 animate-bounce"
              />
              
              <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-yellow-400 bg-clip-text text-transparent animate-pulse">
                MONAPY
              </h1>
              
              <p className="text-xl md:text-2xl mb-8 text-purple-200 max-w-2xl mx-auto leading-relaxed">
                🚀 Navigate through crypto candles in this epic blockchain adventure! 
                <br />
                <span className="text-cyan-300">Dodge red candles, collect power-ups, and reach new highs!</span>
              </p>
            </div>

            {/* Features grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="bg-purple-800/30 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:scale-105">
                <div className="text-3xl mb-3">🎮</div>
                <h3 className="text-lg font-semibold mb-2 text-purple-200">Blockchain Gaming</h3>
                <p className="text-sm text-purple-300">Play on Monad blockchain with real wallet integration</p>
              </div>
              
              <div className="bg-blue-800/30 backdrop-blur-sm rounded-xl p-6 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 hover:scale-105">
                <div className="text-3xl mb-3">🏆</div>
                <h3 className="text-lg font-semibold mb-2 text-blue-200">NFT Rewards</h3>
                <p className="text-sm text-blue-300">Mint exclusive NFTs based on your high scores</p>
              </div>
              
              <div className="bg-indigo-800/30 backdrop-blur-sm rounded-xl p-6 border border-indigo-500/30 hover:border-indigo-400/50 transition-all duration-300 hover:scale-105">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="text-lg font-semibold mb-2 text-indigo-200">Power-ups</h3>
                <p className="text-sm text-indigo-300">Collect shields, time slow, and score multipliers</p>
              </div>
            </div>

            {/* Call to action */}
            <div className="bg-gradient-to-r from-purple-600/20 to-cyan-600/20 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/30">
              <h2 className="text-2xl font-bold mb-4 text-yellow-300">
                🔗 Connect Your Wallet to Play!
              </h2>
              <p className="text-purple-200 mb-6">
                Join the adventure and compete for the highest score on the leaderboard
              </p>
              
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-4 text-sm text-purple-300">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    Monad Network
                  </span>
                  <span>•</span>
                  <span>Secure & Fast</span>
                  <span>•</span>
                  <span>Play to Earn NFTs</span>
                </div>
              </div>
            </div>

            {/* Coming Soon - Multiplayer */}
            <div className="mt-8 bg-gradient-to-r from-orange-600/20 to-red-600/20 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/30 relative overflow-hidden">
              {/* Animated background effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400/10 to-red-400/10 animate-pulse"></div>
              
              <div className="relative z-10 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-2xl">🔥</span>
                  <h3 className="text-xl font-bold text-orange-300">COMING SOON</h3>
                  <span className="text-2xl">🔥</span>
                </div>
                
                <h4 className="text-2xl font-bold mb-3 bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                  Multiplayer Mode
                </h4>
                
                <p className="text-orange-200 mb-4 max-w-2xl mx-auto">
                  🚀 Battle your friends in real-time! Race through the market together, steal power-ups, 
                  and see who can survive the longest in the ultimate crypto showdown!
                </p>
                
                <div className="flex flex-wrap justify-center gap-4 text-sm text-orange-300">
                  <span className="flex items-center gap-1">
                    <span className="text-lg">👥</span>
                    Up to 8 Players
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-lg">⚔️</span>
                    Real-time Battles
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-lg">🎁</span>
                    Shared Power-ups
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="text-lg">🏅</span>
                    Team Tournaments
                  </span>
                </div>
                
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full border border-orange-400/30">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-ping"></div>
                  <span className="text-sm text-orange-300 font-medium">In Development</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-6 border-t border-purple-500/20">
          <div className="text-center text-purple-300 text-sm">
            <p>Built on Monad for Monad • Have fun! • 0xGybte 🚀</p>
          </div>
        </footer>
      </main>
    </div>
  );
}