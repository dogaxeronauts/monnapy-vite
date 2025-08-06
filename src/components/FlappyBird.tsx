"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 800;
const BIRD_X = 120;
const BIRD_SIZE = 24; // Increased bird size
const GROUND_HEIGHT = 80;
const GRAVITY = 0.25;
const JUMP_FORCE = -8;
const CANDLE_INTERVAL = 1800;
const MIN_GAP = 160;
const PIXEL_SIZE = 4;
const POWER_UP_INTERVAL = 10000; // Power-up spawn interval in ms
const POWER_UP_DURATION = 5000; // Power-up effect duration in ms

type Candle = {
  x: number;
  type: "green" | "red";
  high: number;
  low: number;
  width: number;
  passed?: boolean;
};

type RugPull = {
  x: number;
  y: number;
  falling: boolean;
};

type PowerUp = {
  x: number;
  y: number;
  type: 'shield' | 'slowTime' | 'doublePoints';
  collected?: boolean;
};

const FlappyBTCChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdYRef = useRef(GAME_HEIGHT / 2);
  const velocityRef = useRef(0);
  const candlesRef = useRef<Candle[]>([]);
  const rugPullsRef = useRef<RugPull[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const lastCandleRef = useRef(Date.now());
  const lastPowerUpRef = useRef(Date.now());
  const animationRef = useRef<number>();
  const activeEffectsRef = useRef<{
    shield?: { until: number };
    slowTime?: { until: number };
    doublePoints?: { until: number };
  }>({});

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [combo, setCombo] = useState(0);
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const spawnPowerUp = () => {
    const types: PowerUp['type'][] = ['shield', 'slowTime', 'doublePoints'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const y = Math.random() * (GAME_HEIGHT - GROUND_HEIGHT - 100) + 50;

    powerUpsRef.current.push({
      x: GAME_WIDTH,
      y,
      type: randomType
    });
  };

  const resetGame = () => {
    setScore(0); // Başlangıç skoru 0 olmalı
    setGameOver(false);
    setGameStarted(false);
    setCombo(0);
    birdYRef.current = GAME_HEIGHT / 2;
    velocityRef.current = 0;
    candlesRef.current = [];
    rugPullsRef.current = [];
    powerUpsRef.current = [];
    lastCandleRef.current = Date.now();
    lastPowerUpRef.current = Date.now();
    activeEffectsRef.current = {};

    // Canvas'ı temizle
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  };

  const flap = () => {
    if (gameOver) {
      resetGame();
      return;
    }

    if (!gameStarted) setGameStarted(true);
    velocityRef.current = JUMP_FORCE;
  };

  const spawnCandle = () => {
    const isGreen = Math.random() > 0.5;
    const gapStart = Math.random() * (GAME_HEIGHT - GROUND_HEIGHT - MIN_GAP - 80) + 40;
    const gapEnd = gapStart + MIN_GAP;

    candlesRef.current.push({
      x: GAME_WIDTH,
      type: isGreen ? "green" : "red",
      low: gapStart,
      high: gapEnd,
      width: 40 + Math.random() * 30
    });

    if (Math.random() < 0.3) {
      rugPullsRef.current.push({
        x: GAME_WIDTH + 20,
        y: -40,
        falling: true
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") flap();
    };
    window.addEventListener("keydown", handleKeyDown);

    const drawPixel = (x: number, y: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.floor(x / PIXEL_SIZE) * PIXEL_SIZE,
        Math.floor(y / PIXEL_SIZE) * PIXEL_SIZE,
        PIXEL_SIZE,
        PIXEL_SIZE
      );
    };

    const drawPixelRect = (x: number, y: number, width: number, height: number, color: string) => {
      for (let i = 0; i < width; i += PIXEL_SIZE) {
        for (let j = 0; j < height; j += PIXEL_SIZE) {
          drawPixel(x + i, y + j, color);
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Background with fixed stars
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // Add fixed stars using pseudo-random positions
      const starPositions = Array.from({ length: 50 }, (_, i) => ({
        x: (Math.sin(i * 467.5489) * 0.5 + 0.5) * GAME_WIDTH,
        y: (Math.cos(i * 364.2137) * 0.5 + 0.5) * (GAME_HEIGHT - GROUND_HEIGHT - 20)
      }));
      
      starPositions.forEach(({x, y}) => {
        const starSize = Math.random() < 0.2 ? PIXEL_SIZE * 2 : PIXEL_SIZE;
        drawPixelRect(x - starSize/2, y - starSize/2, starSize, starSize, "#fef08a");
      });

      // Get current time once for all animations
      const currentTime = Date.now();

      // Draw power-ups
      powerUpsRef.current.forEach((p) => {
        const size = BIRD_SIZE * 0.8;
        const pulseScale = Math.sin(currentTime * 0.01) * 0.2 + 1;
        const actualSize = size * pulseScale;

        let color = "#fff";
        let icon = "";

        switch(p.type) {
          case 'shield':
            color = "#3b82f6"; // blue
            icon = "S";
            break;
          case 'slowTime':
            color = "#8b5cf6"; // purple
            icon = "T";
            break;
          case 'doublePoints':
            color = "#f59e0b"; // amber
            icon = "2x";
            break;
        }

        // Draw power-up background with glow effect
        drawPixelRect(p.x - actualSize/2, p.y - actualSize/2, actualSize, actualSize, color);
        
        // Draw icon
        ctx.fillStyle = "#fff";
        ctx.font = "12px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icon, p.x, p.y);
      });

      // Ground (pixelated with different shades)
      for (let x = 0; x < GAME_WIDTH; x += PIXEL_SIZE) {
        const groundShade = Math.random() < 0.1 ? "#1e1b4b" : "#2e1065";
        drawPixelRect(x, GAME_HEIGHT - GROUND_HEIGHT, PIXEL_SIZE, GROUND_HEIGHT, groundShade);
      }

      // Candles
      candlesRef.current.forEach((c) => {
        const baseColor = c.type === "green" ? "#22c55e" : "#ef4444";
        const darkColor = c.type === "green" ? "#15803d" : "#b91c1c";
        
        // Draw candle body with pixelated effect
        for (let y = 0; y < c.low; y += PIXEL_SIZE) {
          const color = Math.random() < 0.1 ? darkColor : baseColor;
          drawPixelRect(c.x, y, c.width, PIXEL_SIZE, color);
        }
        
        for (let y = c.high; y < GAME_HEIGHT - GROUND_HEIGHT; y += PIXEL_SIZE) {
          const color = Math.random() < 0.1 ? darkColor : baseColor;
          drawPixelRect(c.x, y, c.width, PIXEL_SIZE, color);
        }

        // Draw pixelated wick
        const centerX = c.x + c.width / 2;
        for (let y = c.low; y < c.high; y += PIXEL_SIZE) {
          drawPixel(centerX, y, "#a78bfa");
        }
      });

      // RUG PULLS (pixelated skull emoji style)
      rugPullsRef.current.forEach((r) => {
        // Draw skull base
        const skullSize = 20;
        drawPixelRect(r.x - skullSize/2, r.y - skullSize/2, skullSize, skullSize, "#f43f5e");
        
        // Draw skull eyes
        drawPixelRect(r.x - 6, r.y - 4, PIXEL_SIZE, PIXEL_SIZE, "#fff");
        drawPixelRect(r.x + 2, r.y - 4, PIXEL_SIZE, PIXEL_SIZE, "#fff");
        
        // Draw skull mouth
        drawPixelRect(r.x - 4, r.y + 2, 8, PIXEL_SIZE, "#fff");
      });

      // Bird (pixelated)
      const birdY = birdYRef.current;
      const birdColors = ["#fef08a", "#facc15", "#eab308"];
      
      // Draw bird body
      for (let i = 0; i < BIRD_SIZE; i += PIXEL_SIZE) {
        for (let j = 0; j < BIRD_SIZE; j += PIXEL_SIZE) {
          const color = birdColors[Math.floor(Math.random() * birdColors.length)];
          if (Math.sqrt(Math.pow(i - BIRD_SIZE/2, 2) + Math.pow(j - BIRD_SIZE/2, 2)) < BIRD_SIZE/2) {
            drawPixel(BIRD_X - BIRD_SIZE/2 + i, birdY - BIRD_SIZE/2 + j, color);
          }
        }
      }

      // Score panel with retro style
      const drawRetroPanel = (x: number, y: number, width: number, height: number) => {
        // Panel background
        ctx.fillStyle = "#1e1b4b";
        ctx.fillRect(x, y, width, height);
        
        // Pixel border effect
        ctx.fillStyle = "#818cf8";
        ctx.fillRect(x, y, width, 2); // Top
        ctx.fillRect(x, y, 2, height); // Left
        ctx.fillStyle = "#312e81";
        ctx.fillRect(x, y + height - 2, width, 2); // Bottom
        ctx.fillRect(x + width - 2, y, 2, height); // Right
      };

      // Score display
      drawRetroPanel(10, 10, 200, 40);
      ctx.fillStyle = "#fef08a";
      ctx.font = "20px 'Press Start 2P'";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE:${score}`, 20, 37);

      // Combo display with flash effect
      if (combo > 0) {
        drawRetroPanel(GAME_WIDTH - 210, 10, 200, 40);
        const comboFlash = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
        ctx.fillStyle = `rgb(${255 * comboFlash}, ${180 * comboFlash}, 0)`;
        ctx.font = "20px 'Press Start 2P'";
        ctx.textAlign = "right";
        ctx.fillText(`COMBOx${combo}`, GAME_WIDTH - 20, 37);
      }

      // Draw active effects
      const effects = Object.entries(activeEffectsRef.current)
        .filter(([_, effect]) => effect.until > currentTime);

      effects.forEach(([type, effect], index) => {
        const timeLeft = Math.ceil((effect.until - currentTime) / 1000);
        let color = "#fff";
        let text = "";

        switch(type) {
          case 'shield':
            color = "#3b82f6";
            text = "SHIELD";
            break;
          case 'slowTime':
            color = "#8b5cf6";
            text = "SLOW";
            break;
          case 'doublePoints':
            color = "#f59e0b";
            text = "2X";
            break;
        }

        ctx.font = "12px 'Press Start 2P', monospace";
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.fillText(`${text}: ${timeLeft}s`, 10, 30 + index * 20);
      });

      // Game over with retro arcade style
      if (gameOver) {
        // Dark overlay with scanlines
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Retro scanlines effect
        for (let y = 0; y < GAME_HEIGHT; y += PIXEL_SIZE) {
          ctx.fillStyle = `rgba(255, 255, 255, ${y % (PIXEL_SIZE * 2) === 0 ? 0.03 : 0})`;
          ctx.fillRect(0, y, GAME_WIDTH, 1);
        }

        // Create retro game over box
        const boxWidth = 400;
        const boxHeight = 200;
        const boxX = (GAME_WIDTH - boxWidth) / 2;
        const boxY = (GAME_HEIGHT - boxHeight) / 2;

        // Draw box background with pixel perfect border
        ctx.fillStyle = "#1a103c";
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        
        // Pixel border effect
        const borderColors = ["#4c1d95", "#6d28d9", "#7c3aed"];
        borderColors.forEach((color, i) => {
          ctx.fillStyle = color;
          // Top border
          ctx.fillRect(boxX - i, boxY - i, boxWidth + i * 2, 2);
          // Bottom border
          ctx.fillRect(boxX - i, boxY + boxHeight + i - 2, boxWidth + i * 2, 2);
          // Left border
          ctx.fillRect(boxX - i, boxY - i, 2, boxHeight + i * 2);
          // Right border
          ctx.fillRect(boxX + boxWidth + i - 2, boxY - i, 2, boxHeight + i * 2);
        });

        // Game Over text with arcade style
        const flash = Math.sin(Date.now() * 0.01) > 0;
        ctx.fillStyle = flash ? "#fef08a" : "#facc15";
        ctx.font = "bold 40px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", GAME_WIDTH / 2, boxY + 70);

        // Score display
        ctx.font = "20px 'Press Start 2P'";
        ctx.fillStyle = "#8b5cf6";
        ctx.fillText(`FINAL SCORE: ${score}`, GAME_WIDTH / 2, boxY + 120);

        // Show different messages based on score
        if (score > 100) {
          if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.font = "16px 'Press Start 2P'";
            ctx.fillStyle = "#fef08a"; // Yellow color
            ctx.fillText("NFT MINT AVAILABLE!", GAME_WIDTH / 2, boxY + 160);
          }
        }
        
        ctx.font = "16px 'Press Start 2P'";
        ctx.fillStyle = "#f0f9ff";
        ctx.fillText("PRESS SPACE TO CONTINUE", GAME_WIDTH / 2, boxY + 190);
      }

      if (!gameStarted && !gameOver) {
        const blinkRate = Math.floor(Date.now() / 500) % 2 === 0;
        if (blinkRate) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "16px 'Press Start 2P', monospace";
          ctx.fillText("PRESS SPACE TO START", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
        }
      }
    };

    const gameLoop = () => {
      const currentTime = Date.now();

      if (!gameStarted) {
        birdYRef.current = GAME_HEIGHT / 2;
        draw();
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!gameOver) {
        const hasSlowTime = (activeEffectsRef.current.slowTime?.until ?? 0) > currentTime;
        
        // Apply slow time effect to gravity and velocity
        const gravityMultiplier = hasSlowTime ? 0.5 : 1;
        velocityRef.current += GRAVITY * gravityMultiplier;
        birdYRef.current += velocityRef.current * gravityMultiplier;

        // Spawn mechanics
        if (currentTime - lastCandleRef.current > CANDLE_INTERVAL) {
          spawnCandle();
          lastCandleRef.current = currentTime;
        }

        if (currentTime - lastPowerUpRef.current > POWER_UP_INTERVAL) {
          spawnPowerUp();
          lastPowerUpRef.current = currentTime;
        }

        candlesRef.current = candlesRef.current
          .map((c) => {
            if (!c.passed && c.x + c.width < BIRD_X) {
              c.passed = true;
              setScore((prev) => prev + 100);
            }
            return { ...c, x: c.x - 3 };
          })
          .filter((c) => c.x + c.width > 0);

        rugPullsRef.current = rugPullsRef.current
          .map((r) => ({
            ...r,
            y: r.falling ? r.y + 4 : r.y,
            x: r.x - 3
          }))
          .filter((r) => r.y < GAME_HEIGHT && r.x > -20);

        // Power-up collision and collection
        powerUpsRef.current = powerUpsRef.current
          .map((p) => {
            const dx = p.x - BIRD_X;
            const dy = p.y - birdYRef.current;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (!p.collected && dist < BIRD_SIZE/2 + 10) {
              p.collected = true;

              
              switch(p.type) {
                case 'shield':
                  activeEffectsRef.current.shield = { until: currentTime + POWER_UP_DURATION };
                  break;
                case 'slowTime':
                  activeEffectsRef.current.slowTime = { until: currentTime + POWER_UP_DURATION };
                  break;
                case 'doublePoints':
                  activeEffectsRef.current.doublePoints = { until: currentTime + POWER_UP_DURATION };
                  break;
              }
            }
            return p;
          })
          .filter((p) => !p.collected);

        // Candle collision with shield check
        for (const c of candlesRef.current) {
          const hitX = BIRD_X + BIRD_SIZE/2 > c.x && BIRD_X - BIRD_SIZE/2 < c.x + c.width;
          const hitY = birdYRef.current < c.low || birdYRef.current > c.high;
          if (hitX && hitY) {
            if ((activeEffectsRef.current.shield?.until ?? 0) > currentTime) {
              // Remove the candle instead of game over when shielded
              candlesRef.current = candlesRef.current.filter(candle => candle !== c);
              setCombo(prev => prev + 1);
            } else {
              setGameOver(true);
            }
          }
        }

        // Rug pull collision with shield check
        for (const r of rugPullsRef.current) {
          const dx = r.x - BIRD_X;
          const dy = r.y - birdYRef.current;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < BIRD_SIZE/2 + 10) {
            if ((activeEffectsRef.current.shield?.until ?? 0) > currentTime) {
              // Remove the rug pull instead of game over when shielded
              rugPullsRef.current = rugPullsRef.current.filter(rug => rug !== r);
              setCombo(prev => prev + 1);
            } else {
              setGameOver(true);
            }
          }
        }

        if (
          gameStarted &&
          (birdYRef.current + BIRD_SIZE/2 > GAME_HEIGHT - GROUND_HEIGHT ||
           birdYRef.current < BIRD_SIZE/2)
        ) {
          setGameOver(true);
        }
      }

      draw();
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => {
      cancelAnimationFrame(animationRef.current!);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameOver, gameStarted]);

  const mintNFT = async () => {
    if (!isConnected || !walletClient) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const abi = [
        "function saveScore(uint256 score) external",
      ];
      const contractAddress = "0x8b25528419C36e7fA7b7Cf20272b65Ba41Fca8C4";

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      const tx = await contract.saveScore(score);
      await tx.wait();
      alert("NFT minted successfully! 🎉");
    } catch (err) {
      if (err instanceof Error) {
        alert("Error minting NFT: " + err.message);
      } else {
        alert("Error minting NFT: " + String(err));
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0718] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMCAzNmMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMTgtMThjMy4zMTQgMCA2LTIuNjg2IDYtNnMtMi42ODYtNi02LTYtNiAyLjY4Ni02IDYgMi42ODYgNiA2IDZ6Ii8+PC9nPjwvc3ZnPg==')] opacity-5"></div>

      {/* Arcade Cabinet Style Container */}
      <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 p-10 rounded-[2rem] border-8 border-purple-900/50 shadow-[0_0_100px_rgba(168,85,247,0.3)] backdrop-blur-sm transform -translate-y-8">
        {/* Decorative Top Light */}
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-300 to-yellow-500 animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.5)]"></div>
        </div>

        {/* Game Title with Neon Effect */}
        <div className="text-center mb-8 relative">
          <h1 className="font-['Press_Start_2P'] text-3xl relative">
            <span className="absolute inset-0 text-yellow-300 blur-[2px] animate-pulse">MONNAPY</span>
            <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300">
              MONNAPY
            </span>
          </h1>
          <p className="font-['Press_Start_2P'] text-sm mt-2 relative">
            <span className="absolute inset-0 text-purple-400 blur-[1px]">GMONAD @0xGbyte</span>
            <span className="relative text-purple-300">GMONAD @0xGbyte</span>
          </p>
        </div>

        {/* Game Screen Container with Enhanced CRT Effect */}
        <div className="relative rounded-lg overflow-hidden border-[12px] border-slate-950 shadow-inner">
          {/* CRT Screen Effects */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-20"></div>
            <div className="absolute inset-0" style={{
              backgroundImage: `
                linear-gradient(transparent 50%, rgba(0, 0, 0, 0.1) 50%),
                radial-gradient(circle at center, transparent 50%, rgba(0, 0, 0, 0.3) 100%)
              `,
              backgroundSize: '100% 4px, 100% 100%',
              animation: 'scanline 10s linear infinite',
            }}></div>
          </div>

          {/* Game Canvas */}
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            onClick={flap}
            tabIndex={0}
            className="bg-slate-900 outline-none"
            style={{
              imageRendering: 'pixelated'
            }}
          />
        </div>

        {/* Game Controls and Stats with Arcade Style */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-2 border-purple-500/30">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
            <p className="font-['Press_Start_2P'] text-sm text-purple-300 mb-2 relative z-10">CONTROLS</p>
            <div className="flex items-center justify-center gap-4">
              <div className="px-4 py-2 bg-slate-900/80 rounded border border-purple-500/20">
                <span className="text-yellow-200 text-xs">SPACE</span>
              </div>
              <div className="px-4 py-2 bg-slate-900/80 rounded border border-purple-500/20">
                <span className="text-yellow-200 text-xs">CLICK</span>
              </div>
            </div>
          </div>
          
          <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-2 border-purple-500/30">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
            <p className="font-['Press_Start_2P'] text-sm text-purple-300 mb-2 relative z-10">HIGHSCORE</p>
            <p className="text-2xl text-yellow-300 font-['Press_Start_2P'] relative z-10">{score}</p>
          </div>
        </div>

        {/* NFT Mint Button - Positioned at top when available */}
        {gameOver && score > 100 && (
          <div className="absolute left-1/2 transform -translate-x-1/2 -top-24">
            <div className="relative animate-float">
              {/* Enhanced glow effect background */}
              <div className="absolute inset-0 bg-gradient-radial from-yellow-400/30 to-yellow-400/0 blur-2xl"></div>
              
              {/* Pulsing ring */}
              <div className="absolute -inset-4 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 rounded-2xl opacity-30 animate-pulse-ring"></div>
              
              {/* Animated border */}
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 rounded-xl animate-pulse-border"></div>
              
              {/* Main button with enhanced effects */}
              <button
                onClick={mintNFT}
                className="relative px-8 py-4 bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 rounded-xl 
                          font-['Press_Start_2P'] text-lg text-white shadow-lg hover:shadow-yellow-500/50 
                          transition-all duration-300 border-2 border-yellow-700 transform hover:scale-105 
                          z-10 min-w-[240px] overflow-hidden"
              >
                {/* Multiple animated shine effects */}
                <span className="absolute inset-0 bg-gradient-to-r from-yellow-400/0 via-yellow-400/30 to-yellow-400/0 animate-shine"></span>
                <span className="absolute inset-0 bg-gradient-to-r from-yellow-400/0 via-yellow-400/20 to-yellow-400/0 animate-shine-delayed"></span>
                
                {/* Pixelated texture overlay */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNiIgaGVpZ2h0PSI2IiB2aWV3Qm94PSIwIDAgNiA2IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-20"></div>
                
                <span className="relative">MINT NFT 🏆</span>
              </button>
            </div>
            
            {/* Enhanced floating text with glow */}
            <p className="font-['Press_Start_2P'] text-xs text-yellow-300 mt-4 animate-bounce relative">
              <span className="absolute inset-0 blur-sm text-yellow-200">Score {score} - Eligible for NFT!</span>
              <span className="relative">Score {score} - Eligible for NFT!</span>
            </p>
          </div>
        )}

        {/* Game Status Messages */}
        <div className="text-center mt-8">
          {!gameOver && (
            <div className="inline-block relative">
              <p className="font-['Press_Start_2P'] text-sm text-yellow-300 animate-pulse relative">
                <span className="absolute inset-0 blur-[2px] text-yellow-200">{'< INSERT COIN TO PLAY >'}</span>
                <span className="relative">{'< INSERT COIN TO PLAY >'}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Blockchain Connection Status */}
      <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-3 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-3 rounded-full border border-purple-500/30 shadow-lg">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]`}></div>
          <p className="font-['Press_Start_2P'] text-sm text-slate-300 relative">
            <span className="absolute inset-0 blur-[1px] text-white/50">
              {isConnected ? 'WALLET CONNECTED' : 'CONNECT WALLET'}
            </span>
            <span className="relative">
              {isConnected ? 'WALLET CONNECTED' : 'CONNECT WALLET'}
            </span>
          </p>
        </div>
      </div>

      {/* Animation Keyframes */}
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
        @keyframes glow {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes float {
          0% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shine {
          0% { transform: translateX(-200%) rotate(0deg); }
          100% { transform: translateX(200%) rotate(0deg); }
        }
        @keyframes shine-delayed {
          0% { transform: translateX(-200%) rotate(0deg); }
          25% { transform: translateX(-200%) rotate(0deg); }
          100% { transform: translateX(200%) rotate(0deg); }
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(234, 179, 8, 0.8); }
          50% { border-color: rgba(234, 179, 8, 0.4); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.3; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        .arcade-panel {
          position: relative;
          overflow: hidden;
        }
        .arcade-panel::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            transparent 0%,
            rgba(168, 85, 247, 0.1) 50%,
            transparent 100%
          );
          animation: shine 3s infinite linear;
          pointer-events: none;
        }
        .animate-shine {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.2) 50%,
            transparent 100%
          );
          animation: shine 3s infinite linear;
          pointer-events: none;
        }
        .animate-shine-delayed {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 50%,
            transparent 100%
          );
          animation: shine-delayed 4s infinite linear;
          pointer-events: none;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-pulse-ring {
          animation: pulse-ring 3s ease-in-out infinite;
        }
        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }
        .neon-text {
          text-shadow: 0 0 5px rgba(168, 85, 247, 0.8),
                     0 0 10px rgba(168, 85, 247, 0.5),
                     0 0 15px rgba(168, 85, 247, 0.3);
        }
      `}</style>
    </div>
  );
};

export default FlappyBTCChart;
