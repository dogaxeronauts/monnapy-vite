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
    setScore(100);
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

      // Score and combo with pixelated effect
      ctx.fillStyle = "#e0e7ff";
      ctx.font = "bold 20px 'Press Start 2P', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`SCORE: ${score}`, GAME_WIDTH / 2, 32);

      // Draw combo counter if > 0
      if (combo > 0) {
        ctx.font = "16px 'Press Start 2P', monospace";
        ctx.fillStyle = "#f59e0b";
        ctx.fillText(`COMBO x${combo}`, GAME_WIDTH / 2, 60);
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

      // Game over with CRT screen effect
      if (gameOver) {
        // Dark overlay with scan lines
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        for (let y = 0; y < GAME_HEIGHT; y += PIXEL_SIZE * 2) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.fillRect(0, y, GAME_WIDTH, PIXEL_SIZE);
        }

        // Glitch effect
        const glitchOffset = Math.random() * 5;
        ctx.fillStyle = "#ff0000";
        ctx.font = "bold 28px 'Press Start 2P', monospace";
        ctx.fillText("GAME OVER", GAME_WIDTH / 2 + glitchOffset, GAME_HEIGHT / 2 - 10);
        ctx.fillStyle = "#00ff00";
        ctx.fillText("GAME OVER", GAME_WIDTH / 2 - glitchOffset, GAME_HEIGHT / 2 - 10);
        ctx.fillStyle = "#ffffff";
        ctx.fillText("GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);

        ctx.font = "16px 'Press Start 2P', monospace";
        ctx.fillText("PRESS SPACE", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
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

	useEffect(() => {
	  // Only submit if game is over, game was started, and user is connected
	  if (gameOver && gameStarted && isConnected && walletClient) {
		const submitScore = async () => {
		  try {
			const abi = [
			  "function saveScore(uint256 score) external",
			];
			const contractAddress = "0x8b25528419C36e7fA7b7Cf20272b65Ba41Fca8C4"; // <-- Replace with your contract address

			// Create ethers.js signer from wagmi walletClient
			const provider = new ethers.BrowserProvider(window.ethereum);
			const signer = await provider.getSigner();

			const contract = new ethers.Contract(contractAddress, abi, signer);

			const tx = await contract.saveScore(score);
			await tx.wait();
			alert("Score submitted! NFT minted if eligible.");
		  } catch (err) {
      if (err instanceof Error) {
        alert("Error submitting score: " + err.message);
      } else {
        alert("Error submitting score: " + String(err));
      }
		  }
		};

		submitScore();
	  }
	}, [gameOver, gameStarted, isConnected, walletClient, score]);

  return (
    <div className="flex flex-col items-center mt-6">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-900/20 pointer-events-none" style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 2px)`,
          backgroundSize: '100% 2px',
          animation: 'scanline 10s linear infinite',
        }} />
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onClick={flap}
          tabIndex={0}
          className="border-8 border-slate-800 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.5)] outline-none"
          style={{
            imageRendering: 'pixelated',
            boxShadow: '0 0 10px #4f46e5, 0 0 20px #4f46e5, inset 0 0 15px rgba(79, 70, 229, 0.5)'
          }}
        />
      </div>
      <p className="text-purple-300 font-['Press_Start_2P'] text-xs mt-4 animate-pulse">
        INSERT COIN TO PLAY
      </p>
      <style>{`
        @keyframes scanline {
          0% { transform: translateY(0); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
};

export default FlappyBTCChart;
