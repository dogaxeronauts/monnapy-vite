"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { GAME_CONFIG } from "../config";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
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
  type: 'shield' | 'slowTime' | 'doublePoints' | 'magnet' | 'invincibility' | 'jumpBoost' | 'scoreMultiplier';
  collected?: boolean;
};

type LeaderboardEntry = {
  address: string;
  score: number;
  timestamp: number;
  tier: string;
};

type GameStats = {
  totalGamesPlayed: number;
  totalTimePlayed: number;
  powerUpsCollected: number;
  candlesPassed: number;
  bestCombo: number;
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
    magnet?: { until: number };
    invincibility?: { until: number };
    jumpBoost?: { until: number };
    scoreMultiplier?: { until: number };
  }>({});

  const gameStartTimeRef = useRef<number>(0);
  const gameStatsRef = useRef<GameStats>({
    totalGamesPlayed: 0,
    totalTimePlayed: 0,
    powerUpsCollected: 0,
    candlesPassed: 0,
    bestCombo: 0
  });

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerScores, setPlayerScores] = useState<{[address: string]: number}>({});
  const [isOwner, setIsOwner] = useState(false);
  const [tierUpgradeTime, setTierUpgradeTime] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();

  // Save player score and check for new high score
  const savePlayerScore = (finalScore: number) => {
    if (!address) return;
    
    // Update player scores in localStorage
    const savedScores = JSON.parse(localStorage.getItem('playerScores') || '{}');
    const currentPlayerBest = savedScores[address] || 0;
    
    if (finalScore > currentPlayerBest) {
      savedScores[address] = finalScore;
      localStorage.setItem('playerScores', JSON.stringify(savedScores));
      setPlayerScores(savedScores);
      
      // Update high score if this is the highest overall
      const allScores = Object.values(savedScores) as number[];
      const newHighScore = Math.max(...allScores);
      if (newHighScore > highScore) {
        setHighScore(newHighScore);
        localStorage.setItem('highScore', newHighScore.toString());
      }
    }
  };

  // Load saved scores when component mounts or address changes
  useEffect(() => {
    const savedScores = JSON.parse(localStorage.getItem('playerScores') || '{}');
    const savedHighScore = parseInt(localStorage.getItem('highScore') || '0');
    
    setPlayerScores(savedScores);
    setHighScore(savedHighScore);

    // Check if current address is contract owner
    const checkOwner = async () => {
      if (!address || !isConnected) {
        setIsOwner(false);
        return;
      }

      try {
        const abi = ["function owner() external view returns (address)"];
        const contractAddress = "0x8b25528419C36e7fA7b7Cf20272b65Ba41Fca8C4";
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(contractAddress, abi, provider);
        
        const owner = await contract.owner();
        setIsOwner(address.toLowerCase() === owner.toLowerCase());
      } catch (error) {
        console.error("Error checking owner:", error);
        setIsOwner(false);
      }
    };

    if (isConnected && address) {
      checkOwner();
    }
  }, [address, isConnected]);

  // Get current player's best score
  const getCurrentPlayerBest = () => {
    if (!address) return 0;
    return playerScores[address] || 0;
  };

  // Get NFT tier based on score (updated for contract tiers)
  const getNFTTier = (score: number) => {
    if (score >= 20000) return { tier: 'MYTHIC', color: '#FF00FF', requirement: 20000 };      // Tier 0
    if (score >= 17500) return { tier: 'LEGENDARY', color: '#FFD700', requirement: 17500 };   // Tier 1
    if (score >= 15000) return { tier: 'DIAMOND', color: '#B9F2FF', requirement: 15000 };     // Tier 2
    if (score >= 12500) return { tier: 'PLATINUM', color: '#E5E4E2', requirement: 12500 };    // Tier 3
    if (score >= 10000) return { tier: 'GOLD', color: '#FFD700', requirement: 10000 };        // Tier 4
    if (score >= 7500) return { tier: 'SILVER', color: '#C0C0C0', requirement: 7500 };        // Tier 5
    if (score >= 4500) return { tier: 'BRONZE', color: '#CD7F32', requirement: 4500 };        // Tier 6
    if (score >= 750) return { tier: 'REGULAR', color: '#10B981', requirement: 750 };         // Tier 7
    return { tier: 'NOT_ELIGIBLE', color: '#6B7280', requirement: 750 };
  };

  const spawnPowerUp = () => {
    const types: PowerUp['type'][] = [
      'shield', 'slowTime', 'doublePoints', 'magnet', 
      'invincibility', 'jumpBoost', 'scoreMultiplier'
    ];
    const randomType = types[Math.floor(Math.random() * types.length)];
    const y = Math.random() * (GAME_HEIGHT - GROUND_HEIGHT - 100) + 50;

    powerUpsRef.current.push({
      x: GAME_WIDTH,
      y,
      type: randomType
    });
  };

  // Leaderboard API functions
  const submitScoreToLeaderboard = async (playerAddress: string, finalScore: number) => {
    try {
      const response = await fetch(`${GAME_CONFIG.BACKEND_URL}/api/leaderboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: playerAddress,
          score: finalScore,
          timestamp: Date.now(),
          tier: getNFTTier(finalScore).tier
        }),
      });
      
      if (response.ok) {
        fetchLeaderboard();
      }
    } catch (error) {
      console.log('Leaderboard submit failed:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${GAME_CONFIG.BACKEND_URL}/api/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.slice(0, 10)); // Top 10
      }
    } catch (error) {
      console.log('Leaderboard fetch failed:', error);
    }
  };

  // Load leaderboard on component mount
  useEffect(() => {
    fetchLeaderboard();
    
    // Load game stats from localStorage
    const savedStats = localStorage.getItem('gameStats');
    if (savedStats) {
      gameStatsRef.current = JSON.parse(savedStats);
    }
  }, []);

  const resetGame = () => {
    // Save game stats before reset
    if (gameStarted) {
      gameStatsRef.current.totalGamesPlayed += 1;
      gameStatsRef.current.totalTimePlayed += Date.now() - gameStartTimeRef.current;
      if (combo > gameStatsRef.current.bestCombo) {
        gameStatsRef.current.bestCombo = combo;
      }
      localStorage.setItem('gameStats', JSON.stringify(gameStatsRef.current));
    }
    
    setScore(0);
    setGameOver(false);
    setGameStarted(false);
    setCombo(0);
    setTierUpgradeTime(0);
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

    if (!gameStarted) {
      setGameStarted(true);
      gameStartTimeRef.current = Date.now();
    }
    
    // Apply jump boost effect
    const hasJumpBoost = (activeEffectsRef.current.jumpBoost?.until ?? 0) > Date.now();
    const jumpForce = hasJumpBoost ? JUMP_FORCE * 1.3 : JUMP_FORCE;
    velocityRef.current = jumpForce;
  };

  const handleCanvasClick = () => {
    // Allow flap on any canvas click since leaderboard is now separate
    flap();
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
            icon = "🛡";
            break;
          case 'slowTime':
            color = "#8b5cf6"; // purple
            icon = "⏱";
            break;
          case 'doublePoints':
            color = "#f59e0b"; // amber
            icon = "2×";
            break;
          case 'magnet':
            color = "#ec4899"; // pink
            icon = "🧲";
            break;
          case 'invincibility':
            color = "#10b981"; // emerald
            icon = "⭐";
            break;
          case 'jumpBoost':
            color = "#06b6d4"; // cyan
            icon = "⬆";
            break;
          case 'scoreMultiplier':
            color = "#f97316"; // orange
            icon = "3×";
            break;
        }

        // Draw power-up background with glow effect
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        drawPixelRect(p.x - actualSize/2, p.y - actualSize/2, actualSize, actualSize, color);
        ctx.restore();
        
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

      // Unified Score Panel - Minimal design with better spacing
      const playerBest = getCurrentPlayerBest();
      const panelWidth = 400;
      const panelHeight = playerBest > 0 && playerBest >= 750 ? 95 : (playerBest > 0 ? 75 : 50);
      
      drawRetroPanel(10, 10, panelWidth, panelHeight);
      
      // Main score with pulsing effect
      const scoreFlash = Math.sin(Date.now() * 0.02) * 0.3 + 0.7;
      ctx.fillStyle = `rgb(${254 * scoreFlash}, ${240 * scoreFlash}, ${138})`;
      ctx.font = "18px 'Press Start 2P'";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE: ${score}`, 20, 32);
      
      // Current tier indicator (only show if eligible)
      if (score >= 750) {
        const currentTier = getNFTTier(score);
        ctx.fillStyle = currentTier.color;
        ctx.font = "9px 'Press Start 2P'";
        ctx.fillText(`${currentTier.tier}`, 20, 46);
      }

      // Vertical divider line
      ctx.fillStyle = "#4B5563";
      ctx.fillRect(210, 15, 2, panelHeight - 10);

      // Best score section (right side)
      if (playerBest > 0) {
        // Best score
        ctx.fillStyle = "#a78bfa";
        ctx.font = "14px 'Press Start 2P'";
        ctx.textAlign = "left";
        ctx.fillText(`BEST: ${playerBest}`, 220, 32);
        
        // Progress indicator - only show essential info
        const progress = Math.min((score / playerBest) * 100, 100);
        ctx.font = "9px 'Press Start 2P'";
        
        if (score > playerBest) {
          ctx.fillStyle = "#10b981";
          ctx.fillText(`NEW RECORD! +${score - playerBest}`, 220, 46);
        } else {
          ctx.fillStyle = "#6b7280";
          const progressText = `${progress.toFixed(0)}% | Need: ${playerBest - score}`;
          // Uzun text için truncate
          const maxWidth = 170;
          const textWidth = ctx.measureText(progressText).width;
          if (textWidth > maxWidth) {
            ctx.fillText(`${progress.toFixed(0)}%`, 220, 46);
          } else {
            ctx.fillText(progressText, 220, 46);
          }
        }
        
        // Eligible tier from best score
        const bestTier = getNFTTier(playerBest);
        if (playerBest >= 750) {
          ctx.fillStyle = bestTier.color;
          ctx.font = "9px 'Press Start 2P'";
          ctx.fillText(`ELIGIBLE: ${bestTier.tier}`, 220, 60);
        }
        
        // Simple progress bar at bottom (only if there's space)
        if (panelHeight > 70) {
          const barWidth = 360;
          const barHeight = 6;
          const barX = 20;
          const barY = panelHeight - 15;
          
          // Background
          ctx.fillStyle = "#374151";
          ctx.fillRect(barX, barY, barWidth, barHeight);
          
          // Progress fill
          const progressWidth = (progress / 100) * barWidth;
          ctx.fillStyle = score > playerBest ? "#10b981" : "#3b82f6";
          ctx.fillRect(barX, barY, progressWidth, barHeight);
        }
      }

      // Enhanced Combo display (moved to right side)
      if (combo > 0) {
        drawRetroPanel(GAME_WIDTH - 280, 10, 270, 60);
        const comboFlash = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
        ctx.fillStyle = `rgb(${255 * comboFlash}, ${180 * comboFlash}, 0)`;
        ctx.font = "20px 'Press Start 2P'";
        ctx.textAlign = "right";
        ctx.fillText(`COMBO x${combo}`, GAME_WIDTH - 20, 32);
        
        // Show combo bonus points
        ctx.font = "12px 'Press Start 2P'";
        ctx.fillStyle = "#fef08a";
        ctx.fillText(`+${combo * 50} BONUS!`, GAME_WIDTH - 20, 50);
      }

      // Draw active effects (moved to left side)
      const effects = Object.entries(activeEffectsRef.current)
        .filter(([_, effect]) => effect.until > currentTime);

      effects.forEach(([type, effect], index) => {
        const timeLeft = Math.ceil((effect.until - currentTime) / 1000);
        let color = "#fff";
        let text = "";

        switch(type) {
          case 'shield':
            color = "#3b82f6";
            text = "🛡 SHIELD";
            break;
          case 'slowTime':
            color = "#8b5cf6";
            text = "⏱ SLOW TIME";
            break;
          case 'doublePoints':
            color = "#f59e0b";
            text = "2× POINTS";
            break;
          case 'magnet':
            color = "#ec4899";
            text = "🧲 MAGNET";
            break;
          case 'invincibility':
            color = "#10b981";
            text = "⭐ INVINCIBLE";
            break;
          case 'jumpBoost':
            color = "#06b6d4";
            text = "⬆ JUMP BOOST";
            break;
          case 'scoreMultiplier':
            color = "#f97316";
            text = "3× SCORE";
            break;
        }

        ctx.font = "11px 'Press Start 2P', monospace";
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.fillText(`${text}: ${timeLeft}s`, 10, 80 + index * 18);
      });

      // Tier upgrade notification
      if (tierUpgradeTime > 0 && (currentTime - tierUpgradeTime) < 3000) {
        const timeElapsed = currentTime - tierUpgradeTime;
        const opacity = Math.max(0, 1 - (timeElapsed / 3000));
        const scale = Math.min(1, timeElapsed / 500);
        
        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Background flash
        ctx.fillStyle = `rgba(255, 215, 0, ${opacity * 0.3})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Tier upgrade text
        const currentTier = getNFTTier(score);
        ctx.fillStyle = currentTier.color;
        ctx.font = `${24 * scale}px 'Press Start 2P'`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        const bounceY = Math.sin((timeElapsed / 200) * Math.PI) * 10;
        ctx.fillText(`TIER UPGRADE!`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30 + bounceY);
        
        ctx.font = `${18 * scale}px 'Press Start 2P'`;
        ctx.fillText(`${currentTier.tier} UNLOCKED!`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10 + bounceY);
        
        ctx.restore();
      }

      if (!gameStarted && !gameOver) {
        const blinkRate = Math.floor(Date.now() / 500) % 2 === 0;
        if (blinkRate) {
          ctx.fillStyle = "#ffffff";
          ctx.font = "16px 'Press Start 2P', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("PRESS SPACE TO START", GAME_WIDTH / 2, GAME_HEIGHT / 2);

          // Add a pulsing glow effect
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#4c1d95";
          ctx.fillText("PRESS SPACE TO START", GAME_WIDTH / 2, GAME_HEIGHT / 2);
          ctx.globalAlpha = 1.0;
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
              gameStatsRef.current.candlesPassed += 1;
              
              // Calculate points with multipliers
              const hasDoublePoints = (activeEffectsRef.current.doublePoints?.until ?? 0) > currentTime;
              const hasScoreMultiplier = (activeEffectsRef.current.scoreMultiplier?.until ?? 0) > currentTime;
              
              let points = 100;
              if (hasDoublePoints) points *= 2;
              if (hasScoreMultiplier) points *= 3;
              
              setScore((prev) => {
                const newScore = prev + points;
                
                // Check for tier upgrade
                const currentTier = getNFTTier(newScore);
                const previousTier = getNFTTier(prev);
                
                if (currentTier.tier !== previousTier.tier && newScore >= 750) {
                  setTierUpgradeTime(Date.now());
                }
                
                return newScore;
              });
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
            // Magnet effect - attract nearby power-ups
            if ((activeEffectsRef.current.magnet?.until ?? 0) > currentTime) {
              const magnetRange = 80;
              const dx = p.x - BIRD_X;
              const dy = p.y - birdYRef.current;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist < magnetRange && !p.collected) {
                const pullForce = 0.3;
                p.x -= (dx / dist) * pullForce * (magnetRange - dist);
                p.y -= (dy / dist) * pullForce * (magnetRange - dist);
              }
            }
            
            const dx = p.x - BIRD_X;
            const dy = p.y - birdYRef.current;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (!p.collected && dist < BIRD_SIZE/2 + 15) {
              p.collected = true;
              gameStatsRef.current.powerUpsCollected += 1;

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
                case 'magnet':
                  activeEffectsRef.current.magnet = { until: currentTime + POWER_UP_DURATION };
                  break;
                case 'invincibility':
                  activeEffectsRef.current.invincibility = { until: currentTime + POWER_UP_DURATION };
                  break;
                case 'jumpBoost':
                  activeEffectsRef.current.jumpBoost = { until: currentTime + POWER_UP_DURATION };
                  break;
                case 'scoreMultiplier':
                  activeEffectsRef.current.scoreMultiplier = { until: currentTime + POWER_UP_DURATION };
                  break;
              }
            }
            return { ...p, x: p.x - 3 }; // Move power-ups left
          })
          .filter((p) => !p.collected && p.x > -30);

        // Candle collision with shield/invincibility check
        for (const c of candlesRef.current) {
          const hitX = BIRD_X + BIRD_SIZE/2 > c.x && BIRD_X - BIRD_SIZE/2 < c.x + c.width;
          const hitY = birdYRef.current + BIRD_SIZE/2 < c.low || birdYRef.current - BIRD_SIZE/2 > c.high;
          if (hitX && hitY) {
            const hasShield = (activeEffectsRef.current.shield?.until ?? 0) > currentTime;
            const hasInvincibility = (activeEffectsRef.current.invincibility?.until ?? 0) > currentTime;
            
            if (hasShield || hasInvincibility) {
              // Remove the candle instead of game over when protected
              candlesRef.current = candlesRef.current.filter(candle => candle !== c);
              setCombo(prev => {
                const newCombo = prev + 1;
                // Add combo bonus points
                setScore(currentScore => currentScore + (newCombo * 50));
                return newCombo;
              });
            } else {
              setGameOver(true);
              // Save player score when game ends
              savePlayerScore(score);
              if (address) {
                submitScoreToLeaderboard(address, score);
              }
              return; // Stop game loop immediately when game over
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
              setCombo(prev => {
                const newCombo = prev + 1;
                // Add combo bonus points
                setScore(currentScore => currentScore + (newCombo * 50));
                return newCombo;
              });
            } else {
              setGameOver(true);
              // Save player score when game ends
              savePlayerScore(score);
            }
          }
        }

        if (
          gameStarted &&
          (birdYRef.current + BIRD_SIZE/2 > GAME_HEIGHT - GROUND_HEIGHT ||
           birdYRef.current < BIRD_SIZE/2)
        ) {
          setGameOver(true);
          // Save player score when game ends
          savePlayerScore(score);
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
  }, [gameOver, gameStarted, score, combo, tierUpgradeTime, address, playerScores]); // Added address and playerScores for live updates

  // Function to get game signature from backend
  const getGameSignature = async (playerAddress: string, finalScore: number) => {
    try {
      const response = await fetch(`${GAME_CONFIG.BACKEND_URL}/api/get-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: playerAddress,
          score: finalScore
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to get game signature:', error);
      throw new Error('Failed to get game authorization. Please try again.');
    }
  };

  // Function to get achievement signature
  const getAchievementSignature = async (playerAddress: string, finalScore: number) => {
    try {
      const response = await fetch(`${GAME_CONFIG.BACKEND_URL}/api/get-achievement-signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: playerAddress,
          score: finalScore
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to get achievement signature:', error);
      throw new Error('Failed to get achievement authorization. Please try again.');
    }
  };

  const mintNFT = async () => {
    if (!isConnected || !walletClient || !address) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const currentPlayerBest = getCurrentPlayerBest();
      const nftTier = getNFTTier(currentPlayerBest);
      
      // Security check: User can only mint their exact tier based on their best score
      if (currentPlayerBest < 750) {
        alert("Your best score is too low to mint any NFT! Need at least 750 points.");
        return;
      }

      // Contract ABI with new signature-based minting
      const abi = [
        "function mint(bytes calldata signature) external payable",
        "function getUserTier(address user) external view returns (uint256)",
        "function scoreOf(address user) external view returns (uint256)",
        "function tiers(uint256 tier) external view returns (uint256 minScore, uint256 maxScore, uint256 maxSupply, uint256 price, uint256 minted)",
        "function saleActive() external view returns (bool)",
        "function hasMintedTier(address user, uint256 tier) external view returns (bool)"
      ];
      
      const contractAddress = GAME_CONFIG.CONTRACT_ADDRESS;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      // Check if sale is active
      const saleActive = await contract.saleActive();
      if (!saleActive) {
        alert("NFT sale is not currently active!");
        return;
      }

      // Check user's on-chain score
      const onChainScore = await contract.scoreOf(address);
      if (Number(onChainScore) < currentPlayerBest) {
        alert(`Your on-chain score (${onChainScore}) is lower than your local best (${currentPlayerBest}). Please wait for score sync or contact admin.`);
        return;
      }

      // Get tier information
      const tierIndex = getTierNumber(currentPlayerBest);
      const tierInfo = await contract.tiers(tierIndex);
      const [, , maxSupply, price, minted] = tierInfo;

      // Check if tier is sold out
      if (Number(minted) >= Number(maxSupply)) {
        alert(`${nftTier.tier} tier is sold out!`);
        return;
      }

      // Check if user already minted this tier
      const alreadyMinted = await contract.hasMintedTier(address, tierIndex);
      if (alreadyMinted) {
        alert(`You have already minted a ${nftTier.tier} NFT!`);
        return;
      }

      // Get game signature from backend - THIS IS THE KEY SECURITY FEATURE
      alert("Getting game authorization...");
      const signatureResult = await getGameSignature(address, currentPlayerBest);
      
      if (!signatureResult || !signatureResult.signature) {
        alert("Failed to get game authorization. You can only mint through the game!");
        return;
      }

      // Mint NFT with signature - only possible through game backend
      alert("Minting NFT with game authorization...");
      const tx = await contract.mint(signatureResult.signature, { value: price });
      await tx.wait();
      
      alert(`${nftTier.tier} NFT minted successfully! 🎉 (Based on your best score: ${currentPlayerBest})`);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("TieredNFT: Invalid signature")) {
          alert("Invalid game authorization! You can only mint through the official game.");
        } else if (err.message.includes("TieredNFT: Already minted")) {
          alert("You have already minted an NFT for this tier!");
        } else if (err.message.includes("TieredNFT: Tier sold out")) {
          alert("This tier is sold out!");
        } else if (err.message.includes("TieredNFT: Wrong payment")) {
          alert("Incorrect payment amount!");
        } else if (err.message.includes("TieredNFT: No eligible tier")) {
          alert("Your score doesn't qualify for any tier.");
        } else if (err.message.includes("Failed to get game authorization")) {
          alert(err.message);
        } else {
          alert("Error minting NFT: " + err.message);
        }
      } else {
        alert("Error minting NFT: " + String(err));
      }
    }
  };

  // Achievement mint function
  const mintAchievement = async () => {
    if (!isConnected || !walletClient || !address) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const currentPlayerBest = getCurrentPlayerBest();
      
      // Check achievement eligibility (score >= 10000)
      if (currentPlayerBest < 10000) {
        alert("Your best score is too low for achievement NFT! Need at least 10,000 points.");
        return;
      }

      // Contract ABI for achievement minting
      const abi = [
        "function mintAchievement(bytes calldata signature) external",
        "function scoreOf(address user) external view returns (uint256)",
        "function hasMintedAchievement(address user) external view returns (bool)"
      ];
      
      const contractAddress = GAME_CONFIG.CONTRACT_ADDRESS;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      // Check if user already minted achievement
      const alreadyMinted = await contract.hasMintedAchievement(address);
      if (alreadyMinted) {
        alert("You have already minted an achievement NFT!");
        return;
      }

      // Check user's on-chain score
      const onChainScore = await contract.scoreOf(address);
      if (Number(onChainScore) < 10000) {
        alert(`Your on-chain score (${onChainScore}) is too low for achievement NFT. Please wait for score sync or contact admin.`);
        return;
      }

      // Get achievement signature from backend
      alert("Getting achievement authorization...");
      const signatureResult = await getAchievementSignature(address, currentPlayerBest);
      
      if (!signatureResult || !signatureResult.signature) {
        alert("Failed to get achievement authorization. You can only mint through the game!");
        return;
      }

      // Mint achievement NFT
      alert("Minting achievement NFT...");
      const tx = await contract.mintAchievement(signatureResult.signature);
      await tx.wait();
      
      alert(`Achievement NFT minted successfully! 🏆 (Score: ${currentPlayerBest})`);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("TieredNFT: Invalid signature")) {
          alert("Invalid game authorization! You can only mint through the official game.");
        } else if (err.message.includes("TieredNFT: Already minted achv")) {
          alert("You have already minted an achievement NFT!");
        } else if (err.message.includes("TieredNFT: Score too low")) {
          alert("Your on-chain score is too low for achievement NFT.");
        } else {
          alert("Error minting achievement NFT: " + err.message);
        }
      } else {
        alert("Error minting achievement NFT: " + String(err));
      }
    }
  };

  // Convert score to tier number for contract
  const getTierNumber = (score: number) => {
    if (score >= 20000) return 0; // Mythic
    if (score >= 17500) return 1; // Legendary  
    if (score >= 15000) return 2; // Diamond
    if (score >= 12500) return 3; // Platinum
    if (score >= 10000) return 4; // Gold
    if (score >= 7500) return 5;  // Silver
    if (score >= 4500) return 6;  // Bronze
    if (score >= 750) return 7;   // Regular
    return 7; // Default to Regular
  };

  // Admin function to batch update scores on-chain
  const batchUpdateScores = async () => {
    if (!isConnected || !walletClient) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const abi = [
        "function batchSetScores(address[] calldata users, uint256[] calldata scores) external",
        "function owner() external view returns (address)"
      ];
      
      const contractAddress = GAME_CONFIG.CONTRACT_ADDRESS;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      // Check if caller is owner
      const owner = await contract.owner();
      if (address?.toLowerCase() !== owner.toLowerCase()) {
        alert("Only contract owner can update scores!");
        return;
      }

      // Get all player scores from localStorage
      const savedScores = JSON.parse(localStorage.getItem('playerScores') || '{}');
      const addresses = Object.keys(savedScores);
      const scores = Object.values(savedScores);

      if (addresses.length === 0) {
        alert("No scores to update!");
        return;
      }

      // Update scores on-chain
      const tx = await contract.batchSetScores(addresses, scores);
      await tx.wait();
      
      alert(`Successfully updated ${addresses.length} player scores on-chain! 🎉`);
    } catch (err) {
      if (err instanceof Error) {
        alert("Error updating scores: " + err.message);
      } else {
        alert("Error updating scores: " + String(err));
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0718] flex flex-col items-center justify-center relative overflow-hidden p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMCAzNmMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMTgtMThjMy4zMTQgMCA2LTIuNjg2IDYtNnMtMi42ODYtNi02LTYtNiAyLjY4Ni02IDYgMi42ODYgNiA2IDZ6Ii8+PC9nPjwvc3ZnPg==')] opacity-5"></div>

      {/* Arcade Cabinet Style Container with Grid Layout */}
      <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 p-6 md:p-10 rounded-[2rem] border-8 border-purple-900/50 shadow-[0_0_100px_rgba(168,85,247,0.3)] backdrop-blur-sm w-full max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-8 items-start">
          {/* Game Section */}
          <div className="space-y-8">
            {/* 3D Spinning Monad Logo */}
            <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 z-30">
              <div className="scene">
                <div className="logo-wrapper">
                  <img src="/monad_logo.png" alt="Monad Logo Front" className="logo-front" />
                  <img src="/monad_logo.png" alt="Monad Logo Back" className="logo-back" />
                </div>
              </div>
            </div>

            {/* Game Title with Neon Effect */}
            <div className="text-center mb-8 relative">
              <h1 className="font-['Press_Start_2P'] text-3xl relative">
                <span className="absolute inset-0 text-yellow-300 blur-[2px] animate-pulse">MONAPY</span>
                <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300">
                  MONAPY
                </span>
              </h1>
              <p className="font-['Press_Start_2P'] text-sm mt-2 relative">
                <span className="absolute inset-0 text-purple-400 blur-[1px]">GMONAD @0xGbyte</span>
                <span className="relative text-purple-300">GMONAD @0xGbyte</span>
              </p>
            </div>

            {/* Game Screen Container with Enhanced CRT Effect */}
            <div className="relative rounded-lg overflow-hidden border-[12px] border-slate-950 shadow-inner w-full">
              {/* CRT Screen Effects */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-20"></div>
                <div className="absolute inset-0" style={{
                  backgroundImage: `
                    linear-gradient(transparent 50%, rgba(0, 0, 0, 0.1) 50%),
                    radial-gradient(circle at center, transparent 50%, rgba(0, 0, 0, 0.3) 100%)
                  `,
                  backgroundSize: '100% 4px, 100% 100%',
                }}></div>
              </div>

              {/* Game Canvas */}
              <canvas
                ref={canvasRef}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                onClick={handleCanvasClick}
                tabIndex={0}
                className="bg-slate-900 outline-none w-full h-auto max-w-full"
                style={{
                  imageRendering: 'pixelated',
                  aspectRatio: `${GAME_WIDTH}/${GAME_HEIGHT}`
                }}
              />

              {/* Game Over Box Overlay - Positioned in Canvas Center */}
              {gameOver && (
                <div className="game-over-overlay absolute z-50 pointer-events-none" style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '400px',
                  height: '280px',
                  background: '#1a103c',
                  border: 'none',
                  borderRadius: '0',
                  boxShadow: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  imageRendering: 'pixelated'
                }}>
                  
                  {/* Pixel Perfect Border */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: `
                      linear-gradient(to right, #4c1d95 0px, #4c1d95 2px, transparent 2px),
                      linear-gradient(to bottom, #4c1d95 0px, #4c1d95 2px, transparent 2px),
                      linear-gradient(to left, #6d28d9 0px, #6d28d9 2px, transparent 2px),
                      linear-gradient(to top, #6d28d9 0px, #6d28d9 2px, transparent 2px)
                    `,
                    backgroundSize: '100% 2px, 2px 100%, 100% 2px, 2px 100%',
                    backgroundPosition: 'top, right, bottom, left',
                    backgroundRepeat: 'no-repeat'
                  }}></div>
                  
                  {/* Corner Pixels */}
                  <div className="absolute top-0 left-0 w-2 h-2 bg-purple-600"></div>
                  <div className="absolute top-0 right-0 w-2 h-2 bg-purple-600"></div>
                  <div className="absolute bottom-0 left-0 w-2 h-2 bg-purple-600"></div>
                  <div className="absolute bottom-0 right-0 w-2 h-2 bg-purple-600"></div>

                  {/* Main Title */}
                  <div className="text-center relative z-10">
                    {(() => {
                      const playerBest = getCurrentPlayerBest();
                      const nftTier = getNFTTier(playerBest);
                      
                      if (playerBest >= 750) {
                        return (
                          <h2 className="font-['Press_Start_2P'] text-lg mb-2 pixel-text" 
                              style={{ 
                                color: nftTier.color,
                                textShadow: `2px 2px 0px #000, 0 0 8px ${nftTier.color}`,
                                imageRendering: 'pixelated'
                              }}>
                            {nftTier.tier} TIER ELIGIBLE!
                          </h2>
                        );
                      } else {
                        return (
                          <h2 className="font-['Press_Start_2P'] text-lg mb-2 pixel-text" 
                              style={{ 
                                color: '#ef4444',
                                textShadow: '2px 2px 0px #000, 0 0 8px #ef4444',
                                imageRendering: 'pixelated'
                              }}>
                            NOT ENOUGH!
                          </h2>
                        );
                      }
                    })()}
                  </div>

                  {/* Score Information Panel */}
                  <div className="relative w-full max-w-xs mx-auto" style={{
                    background: '#312e81',
                    border: '2px solid #818cf8',
                    imageRendering: 'pixelated'
                  }}>
                    {/* Panel border pixels */}
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-slate-900"></div>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-slate-900"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-slate-900"></div>
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-slate-900"></div>
                    
                    <div className="p-3 space-y-2 text-center relative z-10">
                      <div className="font-['Press_Start_2P'] text-sm" 
                           style={{ 
                             color: '#fef08a',
                             textShadow: '1px 1px 0px #000',
                             imageRendering: 'pixelated'
                           }}>
                        CURRENT: {score}
                      </div>
                      
                      {getCurrentPlayerBest() > 0 && (
                        <div className="font-['Press_Start_2P'] text-xs" 
                             style={{ 
                               color: getNFTTier(getCurrentPlayerBest()).color,
                               textShadow: '1px 1px 0px #000',
                               imageRendering: 'pixelated'
                             }}>
                          BEST: {getCurrentPlayerBest()}
                          {getCurrentPlayerBest() >= 750 && ` (${getNFTTier(getCurrentPlayerBest()).tier})`}
                        </div>
                      )}
                      
                      {score > getCurrentPlayerBest() && (
                        <div className="font-['Press_Start_2P'] text-xs animate-pulse" 
                             style={{ 
                               color: '#fef08a',
                               textShadow: '1px 1px 0px #000',
                               imageRendering: 'pixelated'
                             }}>
                          NEW PERSONAL BEST!
                        </div>
                      )}
                      
                      {getCurrentPlayerBest() < 750 && (
                        <div className="font-['Press_Start_2P'] text-xs" 
                             style={{ 
                               color: '#fef08a',
                               textShadow: '1px 1px 0px #000',
                               imageRendering: 'pixelated'
                             }}>
                          NEED 750+ FOR NFT!
                        </div>
                      )}
                      
                      {address && getCurrentPlayerBest() >= 750 && (
                        <div className="font-['Press_Start_2P'] text-xs" 
                             style={{ 
                               color: '#a78bfa',
                               textShadow: '1px 1px 0px #000',
                               imageRendering: 'pixelated'
                             }}>
                          {address.slice(0, 8)}...{address.slice(-6)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mint Button - Arcade Style */}
                  {getCurrentPlayerBest() >= 750 && (
                    <div className="relative">
                      <button
                        onClick={mintNFT}
                        disabled={!isConnected}
                        className="pointer-events-auto font-['Press_Start_2P'] text-xs transition-all duration-200 hover:scale-105 active:scale-95"
                        style={{
                          padding: '12px 20px',
                          background: `${getNFTTier(getCurrentPlayerBest()).color}`,
                          border: '3px solid #000',
                          borderRadius: '0',
                          color: '#000',
                          textShadow: 'none',
                          boxShadow: '4px 4px 0px #000',
                          imageRendering: 'pixelated',
                          fontWeight: 'bold'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translate(-2px, -2px)';
                          e.currentTarget.style.boxShadow = '6px 6px 0px #000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translate(0px, 0px)';
                          e.currentTarget.style.boxShadow = '4px 4px 0px #000';
                        }}
                      >
                        MINT {getNFTTier(getCurrentPlayerBest()).tier} NFT
                      </button>
                      
                      {/* Button highlight pixels */}
                      <div className="absolute top-1 left-1 w-2 h-2 bg-white opacity-60"></div>
                    </div>
                  )}

                  {/* Continue Prompt - Blinking Arcade Style */}
                  <div className="font-['Press_Start_2P'] text-xs text-center relative z-10" 
                       style={{ 
                         color: '#f0f9ff',
                         textShadow: '1px 1px 0px #000, 0 0 8px #4c1d95',
                         imageRendering: 'pixelated',
                         animation: 'pixelBlink 1s infinite'
                       }}>
                    PRESS SPACE TO CONTINUE
                  </div>
                </div>
              )}
            </div>

            {/* Game Controls and Stats with Arcade Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <p className="font-['Press_Start_2P'] text-sm text-purple-300 mb-2 relative z-10">PLAYER STATS</p>
                <p className="text-2xl text-yellow-300 font-['Press_Start_2P'] relative z-10">{getCurrentPlayerBest()}</p>
                {address && (
                  <p className="text-xs text-purple-200 mt-1 relative z-10 break-all">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </p>
                )}
                
                {/* Game Stats */}
                <div className="mt-3 space-y-1 relative z-10">
                  <p className="text-xs text-purple-300">
                    Games: {gameStatsRef.current.totalGamesPlayed}
                  </p>
                  <p className="text-xs text-purple-300">
                    Power-ups: {gameStatsRef.current.powerUpsCollected}
                  </p>
                  <p className="text-xs text-purple-300">
                    Best Combo: {gameStatsRef.current.bestCombo}
                  </p>
                </div>
              </div>

              {/* Admin Panel - Only visible to contract owner */}
              {isOwner && (
                <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-red-800 to-red-900 p-4 border-2 border-red-500/30">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent"></div>
                  <p className="font-['Press_Start_2P'] text-sm text-red-300 mb-2 relative z-10">ADMIN PANEL</p>
                  <button
                    onClick={batchUpdateScores}
                    className="px-3 py-2 bg-red-900/80 rounded border border-red-500/20 text-yellow-200 text-xs font-['Press_Start_2P'] hover:bg-red-800/80 transition-colors relative z-10"
                  >
                    SYNC SCORES
                  </button>
                  <p className="text-xs text-red-200 mt-1 relative z-10">
                    Update on-chain scores
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Leaderboard Column - Right Side */}
          <div className="xl:sticky xl:top-8">
            <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-yellow-800 to-yellow-900 p-4 border-2 border-yellow-500/30 h-[600px] flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent"></div>
              <h3 className="font-['Press_Start_2P'] text-sm text-yellow-300 mb-4 relative z-10">🏆 LIVE LEADERBOARD</h3>
              
              <div className="flex-1 space-y-2 relative z-10 overflow-y-auto pr-2">
                {leaderboard.length > 0 ? (
                  leaderboard.map((entry, index) => (
                    <div 
                      key={`${entry.address}-${entry.timestamp}`} 
                      className={`flex justify-between items-center p-2 rounded border transition-all ${
                        address && entry.address.toLowerCase() === address.toLowerCase()
                          ? 'bg-yellow-900/60 border-yellow-400/50 shadow-lg'
                          : 'bg-slate-900/60 border-yellow-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-['Press_Start_2P'] w-6 ${
                          index === 0 ? 'text-yellow-400' : 
                          index === 1 ? 'text-gray-300' : 
                          index === 2 ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          #{index + 1}
                        </span>
                        <span className="text-white text-xs font-['Press_Start_2P']">
                          {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                        </span>
                        <span 
                          className="text-xs font-['Press_Start_2P'] px-2 py-1 rounded"
                          style={{ color: getNFTTier(entry.score).color, backgroundColor: `${getNFTTier(entry.score).color}20` }}
                        >
                          {entry.tier.slice(0, 3)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-yellow-300 text-xs font-['Press_Start_2P']">{entry.score}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 text-xs font-['Press_Start_2P'] mt-8">
                    No scores yet. Be the first! 🚀
                  </div>
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-yellow-500/20 relative z-10">
                <button
                  onClick={fetchLeaderboard}
                  className="w-full px-3 py-2 bg-yellow-900/80 rounded border border-yellow-500/20 text-yellow-200 text-xs font-['Press_Start_2P'] hover:bg-yellow-800/80 transition-colors"
                >
                  🔄 REFRESH
                </button>
                
                {/* Leaderboard Stats */}
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-yellow-200">
                    Total Players: {leaderboard.length}
                  </p>
                  {address && (() => {
                    const playerRank = leaderboard.findIndex(entry => 
                      entry.address.toLowerCase() === address.toLowerCase()) + 1;
                    return playerRank > 0 && (
                      <p className="text-xs text-yellow-300 font-['Press_Start_2P']">
                        Your Rank: #{playerRank}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

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
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="flex items-center gap-3 bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-3 rounded-full border border-purple-500/30 shadow-lg">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]`}></div>
          <p className="font-['Press_Start_2P'] text-xs md:text-sm text-slate-300 relative">
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
        @keyframes spinY {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(360deg); }
        }
        @keyframes pixelBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-200%) rotate(35deg); }
          100% { transform: translateX(200%) rotate(35deg); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        
        /* 3D Logo Animation Styles */
        .scene {
          width: 120px;
          height: 120px;
          perspective: 800px;
          margin: 0 auto;
        }
        
        .logo-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: spinY 4s linear infinite;
        }
        
        .logo-wrapper img {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 80px;
          height: 80px;
          margin: -40px 0 0 -40px;
          backface-visibility: hidden;
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.5);
        }
        
        .logo-back {
          transform: rotateY(180deg);
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
        .pixel-text {
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  );
};

export default FlappyBTCChart;
