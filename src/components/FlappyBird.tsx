"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { GAME_CONFIG } from "../config";

const GAME_WIDTH = 1200; // Wider for cinematic experience
const GAME_HEIGHT = 580; // Reduced height for better viewport fit
const BIRD_X = 160; // Adjusted proportionally
const BIRD_SIZE = 60; // Increased bird size for better visibility
const GROUND_HEIGHT = 90; // Increased proportionally
const GRAVITY = 0.25;
const JUMP_FORCE = -8;
const CANDLE_INTERVAL = 1800;
const MIN_GAP = 180; // Increased gap for larger screen
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

  // New refs for visual effects
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
  }>>([]);
  const screenShakeRef = useRef({ x: 0, y: 0, intensity: 0, duration: 0 });
  const lastJumpTimeRef = useRef(0);
  const hedgehogImageRef = useRef<HTMLImageElement | null>(null);
  const imageLoadedRef = useRef(false);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerScores, setPlayerScores] = useState<{[address: string]: number}>({});
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
  }, [address, isConnected]);

  // Load hedgehog image
  useEffect(() => {
    const loadHedgehogImage = () => {
      const img = new Image();
      img.onload = () => {
        hedgehogImageRef.current = img;
        imageLoadedRef.current = true;
      };
      img.onerror = () => {
        console.error('Failed to load hedgehog image');
        imageLoadedRef.current = false;
      };
      img.src = '/hedgehog.png';
    };

    loadHedgehogImage();
  }, []);

  // Get current player's best score
  const getCurrentPlayerBest = () => {
    if (!address) return 0;
    return playerScores[address] || 0;
  };

  // Get NFT tier based on score (matches contract enum exactly)
  const getNFTTier = (score: number) => {
    if (score >= 20000) return { tier: 'MYTHIC', color: '#FF00FF', requirement: 20000, enumValue: 8 };      // Tier.Mythic
    if (score >= 17500) return { tier: 'LEGENDARY', color: '#FFD700', requirement: 17500, enumValue: 7 };   // Tier.Legendary
    if (score >= 15000) return { tier: 'DIAMOND', color: '#B9F2FF', requirement: 15000, enumValue: 6 };     // Tier.Diamond
    if (score >= 12500) return { tier: 'PLATINUM', color: '#E5E4E2', requirement: 12500, enumValue: 5 };    // Tier.Platinum
    if (score >= 10000) return { tier: 'GOLD', color: '#FFD700', requirement: 10000, enumValue: 4 };        // Tier.Gold
    if (score >= 7500) return { tier: 'SILVER', color: '#C0C0C0', requirement: 7500, enumValue: 3 };        // Tier.Silver
    if (score >= 4500) return { tier: 'BRONZE', color: '#CD7F32', requirement: 4500, enumValue: 2 };        // Tier.Bronze
    if (score >= 750) return { tier: 'REGULAR', color: '#10B981', requirement: 750, enumValue: 1 };         // Tier.Regular
    return { tier: 'NONE', color: '#6B7280', requirement: 750, enumValue: 0 };                              // Tier.None
  };

  // Visual effects functions
  const addScreenShake = (intensity: number, duration: number) => {
    screenShakeRef.current = { 
      x: 0, 
      y: 0, 
      intensity, 
      duration: Date.now() + duration 
    };
  };

  const createParticles = (x: number, y: number, count: number, color: string, spread = 50) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * spread,
        vy: (Math.random() - 0.5) * spread,
        life: 1,
        maxLife: Math.random() * 30 + 30,
        color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const updateParticles = () => {
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.5; // gravity
      particle.life -= 1;
      return particle.life > 0;
    });
  };

  const updateScreenShake = () => {
    const currentTime = Date.now();
    if (screenShakeRef.current.duration > currentTime) {
      const remaining = (screenShakeRef.current.duration - currentTime) / 1000;
      const intensity = screenShakeRef.current.intensity * remaining;
      screenShakeRef.current.x = (Math.random() - 0.5) * intensity;
      screenShakeRef.current.y = (Math.random() - 0.5) * intensity;
    } else {
      screenShakeRef.current.x = 0;
      screenShakeRef.current.y = 0;
    }
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
    
    // Create jump particles
    createParticles(BIRD_X, birdYRef.current, 8, "#fef08a", 30);
    lastJumpTimeRef.current = Date.now();
    
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
      // Apply screen shake
      updateScreenShake();
      ctx.save();
      ctx.translate(screenShakeRef.current.x, screenShakeRef.current.y);
      
      ctx.clearRect(-screenShakeRef.current.x, -screenShakeRef.current.y, GAME_WIDTH + Math.abs(screenShakeRef.current.x * 2), GAME_HEIGHT + Math.abs(screenShakeRef.current.y * 2));

      // Background with parallax effect
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // Add moving background elements for depth
      const time = Date.now() * 0.0001;
      for (let i = 0; i < 3; i++) {
        const layer = i + 1;
        const speed = layer * 0.2;
        const offset = (time * speed * 100) % (GAME_WIDTH + 100);
        
        // Distant mountains/planets
        ctx.fillStyle = `rgba(75, 85, 99, ${0.1 / layer})`;
        for (let x = -100; x < GAME_WIDTH + 100; x += 150) {
          const mountainX = x - offset;
          if (mountainX > -100 && mountainX < GAME_WIDTH + 100) {
            const height = 50 + Math.sin((mountainX + i * 50) * 0.01) * 20;
            ctx.fillRect(mountainX, GAME_HEIGHT - GROUND_HEIGHT - height, 80, height);
          }
        }
      }
      
      // Enhanced stars with twinkling effect
      const starPositions = Array.from({ length: 80 }, (_, i) => ({
        x: (Math.sin(i * 467.5489) * 0.5 + 0.5) * GAME_WIDTH,
        y: (Math.cos(i * 364.2137) * 0.5 + 0.5) * (GAME_HEIGHT - GROUND_HEIGHT - 20),
        twinkle: Math.sin(Date.now() * 0.002 + i) * 0.5 + 0.5
      }));
      
      starPositions.forEach(({x, y, twinkle}) => {
        const starSize = Math.random() < 0.2 ? PIXEL_SIZE * 2 : PIXEL_SIZE;
        const alpha = 0.5 + twinkle * 0.5;
        ctx.save();
        ctx.globalAlpha = alpha;
        drawPixelRect(x - starSize/2, y - starSize/2, starSize, starSize, "#fef08a");
        ctx.restore();
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

      // Bird (hedgehog) with enhanced trail effect
      const birdY = birdYRef.current;
      const rotation = Math.min(Math.max(velocityRef.current * 0.02, -0.5), 0.5);
      
      // Bird trail effect when jumping
      const timeSinceJump = Date.now() - lastJumpTimeRef.current;
      if (timeSinceJump < 300 && imageLoadedRef.current && hedgehogImageRef.current) {
        const trailAlpha = Math.max(0, 1 - timeSinceJump / 300);
        ctx.save();
        ctx.globalAlpha = trailAlpha * 0.4;
        for (let i = 1; i <= 3; i++) {
          const trailY = birdY + velocityRef.current * i * 1.5;
          const trailSize = BIRD_SIZE * (1 - i * 0.15);
          ctx.translate(BIRD_X, trailY);
          ctx.rotate(rotation * (1 - i * 0.2));
          ctx.scale(0.8 - i * 0.1, 0.8 - i * 0.1);
          ctx.drawImage(
            hedgehogImageRef.current,
            -trailSize/2,
            -trailSize/2,
            trailSize,
            trailSize
          );
        }
        ctx.restore();
      }
      
      // Draw hedgehog with rotation and animation
      if (imageLoadedRef.current && hedgehogImageRef.current) {
        ctx.save();
        
        // Add subtle bounce animation
        const bounceOffset = Math.sin(Date.now() * 0.01) * 2;
        
        // Glow effect
        ctx.shadowColor = "#8B5CF6";
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.8;
        
        // Position and rotate hedgehog
        ctx.translate(BIRD_X, birdY + bounceOffset);
        ctx.rotate(rotation);
        
        // Scale slightly based on velocity for dynamic effect
        const scale = 1 + Math.abs(velocityRef.current) * 0.002;
        ctx.scale(scale, scale);
        
        // Draw hedgehog image
        ctx.drawImage(
          hedgehogImageRef.current,
          -BIRD_SIZE/2,
          -BIRD_SIZE/2,
          BIRD_SIZE,
          BIRD_SIZE
        );
        
        ctx.restore();
        
        // Additional glow ring effect
        ctx.save();
        ctx.beginPath();
        ctx.arc(BIRD_X, birdY + bounceOffset, BIRD_SIZE * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = "#8B5CF6";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.restore();
      } else {
        // Fallback to pixelated bird if image not loaded
        const birdColors = ["#8B5CF6", "#A855F7", "#C084FC"];
        
        // Draw bird body with enhanced glow effect
        for (let i = 0; i < BIRD_SIZE; i += PIXEL_SIZE) {
          for (let j = 0; j < BIRD_SIZE; j += PIXEL_SIZE) {
            const color = birdColors[Math.floor(Math.random() * birdColors.length)];
            if (Math.sqrt(Math.pow(i - BIRD_SIZE/2, 2) + Math.pow(j - BIRD_SIZE/2, 2)) < BIRD_SIZE/2) {
              drawPixel(BIRD_X - BIRD_SIZE/2 + i, birdY - BIRD_SIZE/2 + j, color);
            }
          }
        }
        
        // Bird glow effect
        ctx.save();
        ctx.shadowColor = "#8B5CF6";
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < BIRD_SIZE; i += PIXEL_SIZE) {
          for (let j = 0; j < BIRD_SIZE; j += PIXEL_SIZE) {
            if (Math.sqrt(Math.pow(i - BIRD_SIZE/2, 2) + Math.pow(j - BIRD_SIZE/2, 2)) < BIRD_SIZE/2) {
              drawPixel(BIRD_X - BIRD_SIZE/2 + i, birdY - BIRD_SIZE/2 + j, "#8B5CF6");
            }
          }
        }
        ctx.restore();
      }

      // Draw particles
      updateParticles();
      particlesRef.current.forEach(particle => {
        ctx.save();
        ctx.globalAlpha = particle.life / particle.maxLife;
        ctx.fillStyle = particle.color;
        ctx.fillRect(
          Math.floor(particle.x / PIXEL_SIZE) * PIXEL_SIZE,
          Math.floor(particle.y / PIXEL_SIZE) * PIXEL_SIZE,
          particle.size,
          particle.size
        );
        ctx.restore();
      });

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

      // Enhanced Flight HUD - Top Right Corner
      if (gameStarted && !gameOver) {
        const hudX = GAME_WIDTH - 300;
        const hudY = 10;
        
        // HUD Background
        drawRetroPanel(hudX, hudY, 290, 120);
        
        // Flight metrics
        const altitude = Math.max(0, Math.round((GAME_HEIGHT - GROUND_HEIGHT - birdYRef.current) / (GAME_HEIGHT - GROUND_HEIGHT) * 100));
        const velocity = Math.abs(Math.round(velocityRef.current * 10));
        const gameTime = Math.round((Date.now() - gameStartTimeRef.current) / 1000);
        
        ctx.font = "10px 'Press Start 2P'";
        ctx.textAlign = "left";
        
        // Altitude
        ctx.fillStyle = altitude > 80 ? "#ef4444" : altitude > 50 ? "#f59e0b" : "#10b981";
        ctx.fillText(`ALTITUDE: ${altitude}%`, hudX + 10, hudY + 25);
        
        // Velocity
        ctx.fillStyle = velocity > 50 ? "#ef4444" : "#06b6d4";
        ctx.fillText(`VELOCITY: ${velocity}`, hudX + 10, hudY + 40);
        
        // Game Time
        ctx.fillStyle = "#a78bfa";
        ctx.fillText(`TIME: ${gameTime}s`, hudX + 10, hudY + 55);
        
        // Candles Passed
        ctx.fillStyle = "#10b981";
        ctx.fillText(`CANDLES: ${gameStatsRef.current.candlesPassed}`, hudX + 10, hudY + 70);
        
        // Danger Warning
        if (altitude < 20 || altitude > 90) {
          const warningFlash = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(239, 68, 68, ${warningFlash})`;
          ctx.font = "12px 'Press Start 2P'";
          ctx.textAlign = "center";
          ctx.fillText("⚠ DANGER ZONE ⚠", hudX + 145, hudY + 95);
        }
        
        // Mini altitude bar
        const barX = hudX + 200;
        const barY = hudY + 15;
        const barHeight = 80;
        const barWidth = 8;
        
        // Background
        ctx.fillStyle = "#374151";
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Altitude indicator
        const indicatorHeight = (altitude / 100) * barHeight;
        const indicatorY = barY + barHeight - indicatorHeight;
        ctx.fillStyle = altitude > 80 ? "#ef4444" : altitude > 50 ? "#f59e0b" : "#10b981";
        ctx.fillRect(barX, indicatorY, barWidth, indicatorHeight);
        
        // Bird position on altitude bar
        const birdIndicatorY = barY + (birdYRef.current / (GAME_HEIGHT - GROUND_HEIGHT)) * barHeight;
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(barX - 2, birdIndicatorY - 2, barWidth + 4, 4);
      }

      // Enhanced Combo display (below HUD)
      if (combo > 0) {
        const comboX = GAME_WIDTH - 300;
        const comboY = 140;
        
        drawRetroPanel(comboX, comboY, 290, 60);
        const comboFlash = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
        ctx.fillStyle = `rgb(${255 * comboFlash}, ${180 * comboFlash}, 0)`;
        ctx.font = "18px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText(`COMBO x${combo}`, comboX + 145, comboY + 25);
        
        // Show combo bonus points
        ctx.font = "10px 'Press Start 2P'";
        ctx.fillStyle = "#fef08a";
        ctx.fillText(`+${combo * 50} BONUS PER CANDLE!`, comboX + 145, comboY + 45);
        
        // Combo progress bar to next milestone
        const nextMilestone = Math.ceil(combo / 5) * 5;
        const progress = combo / nextMilestone;
        const progressBarWidth = 250;
        const progressBarX = comboX + 20;
        const progressBarY = comboY + 50;
        
        ctx.fillStyle = "#374151";
        ctx.fillRect(progressBarX, progressBarY, progressBarWidth, 4);
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(progressBarX, progressBarY, progressBarWidth * progress, 4);
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
      
      // Restore canvas transform (end screen shake)
      ctx.restore();
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
              
              // Create score particles
              createParticles(c.x + c.width/2, c.low + (c.high - c.low)/2, 5, "#10b981", 25);
              
              setScore((prev) => {
                const newScore = prev + points;
                
                // Check for tier upgrade
                const currentTier = getNFTTier(newScore);
                const previousTier = getNFTTier(prev);
                
                if (currentTier.tier !== previousTier.tier && newScore >= 750) {
                  setTierUpgradeTime(Date.now());
                  addScreenShake(8, 500); // Tier upgrade shake
                  createParticles(GAME_WIDTH/2, GAME_HEIGHT/2, 20, currentTier.color, 100);
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
              
              // Get power-up color for effects
              let powerUpColor = "#fff";
              switch(p.type) {
                case 'shield': powerUpColor = "#3b82f6"; break;
                case 'slowTime': powerUpColor = "#8b5cf6"; break;
                case 'doublePoints': powerUpColor = "#f59e0b"; break;
                case 'magnet': powerUpColor = "#ec4899"; break;
                case 'invincibility': powerUpColor = "#10b981"; break;
                case 'jumpBoost': powerUpColor = "#06b6d4"; break;
                case 'scoreMultiplier': powerUpColor = "#f97316"; break;
              }
              
              // Create power-up collection effects
              createParticles(p.x, p.y, 12, powerUpColor, 40);
              addScreenShake(3, 200);

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
              // Add collision effects
              addScreenShake(15, 800);
              createParticles(BIRD_X, birdYRef.current, 25, "#ef4444", 80);
              
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

  // ScoreTierNFT minting function - with error handling for contract issues
  const mintNFT = async () => {
    if (!isConnected || !walletClient || !address) {
      alert("Please connect your wallet!");
      return;
    }

    try {
      const currentPlayerBest = getCurrentPlayerBest();
      
      // Check if score is eligible for minting
      if (currentPlayerBest < 750) {
        alert("Your score is too low to mint NFT! At least 750 points required.");
        return;
      }

      // ScoreTierNFT Contract ABI - matches your contract exactly
      const abi = [
        "function mint(uint256 score) external",
        "function getTier(uint256 score) external pure returns (uint8)",
        "function tokenTier(uint256 tokenId) external view returns (uint8)",
        "function nextTokenId() external view returns (uint256)",
        "function balanceOf(address owner) external view returns (uint256)"
      ];
      
      const contractAddress = GAME_CONFIG.CONTRACT_ADDRESS;

      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);

      // Local tier calculation - matches contract enum exactly
      const getTierNameFromScore = (score: number) => {
        if (score >= 20000) return "Mythic";      // Tier.Mythic (8)
        if (score >= 17500) return "Legendary";   // Tier.Legendary (7)
        if (score >= 15000) return "Diamond";     // Tier.Diamond (6)
        if (score >= 12500) return "Platinum";    // Tier.Platinum (5)
        if (score >= 10000) return "Gold";        // Tier.Gold (4)
        if (score >= 7500) return "Silver";       // Tier.Silver (3)
        if (score >= 4500) return "Bronze";       // Tier.Bronze (2)
        if (score >= 750) return "Regular";       // Tier.Regular (1)
        return "None";                             // Tier.None (0)
      };

      const tierName = getTierNameFromScore(currentPlayerBest);

      // Try to get tier from contract, but fallback to local calculation
      let contractTierNumber = 0;
      try {
        console.log("Trying to call getTier on contract:", contractAddress);
        contractTierNumber = await contract.getTier(currentPlayerBest);
        console.log("Contract returned tier:", contractTierNumber);
        
        // Contract returns 0 for Tier.None (score too low)
        if (contractTierNumber === 0) {
          alert("Contract says your score is too low! (Tier.None)");
          return;
        }
      } catch (contractError) {
        console.error("Contract getTier failed:", contractError);
        
        // Check if contract exists by trying to get code
        const code = await provider.getCode(contractAddress);
        if (code === "0x") {
          alert(`Error: Contract address ${contractAddress} not found or not deployed yet!\n\nPlease update the correct contract address in config.ts file.`);
          return;
        }
        
        // Contract exists but getTier failed, maybe wrong ABI or function doesn't exist
        alert(`Contract found but getTier function not working. Is the contract deployed correctly?\n\nWill still try to mint ${tierName} tier NFT...`);
      }
      
      const confirmMint = window.confirm(
        `You will mint ${tierName} tier NFT with ${currentPlayerBest} points. Do you confirm?\n\nContract address: ${contractAddress}`
      );
      
      if (!confirmMint) return;

      alert("NFT minting process starting...");
      
      try {
        // Check network first
        const network = await provider.getNetwork();
        if (network.chainId !== 10143n) {
          alert(`❌ Wrong network! Switch to Monad Testnet (Chain ID: 10143).\nCurrently: ${network.chainId}\n\nPlease select Monad Testnet in MetaMask.`);
          return;
        }

        // Try to mint NFT with the player's best score
        const tx = await contract.mint(currentPlayerBest);
        alert("🚀 Mint transaction sent!\nHash: " + tx.hash.slice(0, 20) + "...");
        
        const receipt = await tx.wait();
        if (receipt.status === 1) {
          alert(`🎉 ${tierName} NFT successfully minted!\n\nScore: ${currentPlayerBest}\nTx: ${tx.hash}`);
        } else {
          alert("❌ Transaction failed!");
        }
      } catch (mintError) {
        console.error("Mint failed:", mintError);
        if (mintError instanceof Error) {
          if (mintError.message.includes("Score too low")) {
            alert("Contract error: Score too low!");
          } else if (mintError.message.includes("execution reverted")) {
            alert("Contract error: Transaction reverted. Is the contract working correctly?");
          } else {
            alert("Mint error: " + mintError.message);
          }
        } else {
          alert("Mint error: " + String(mintError));
        }
      }
      
    } catch (err) {
      console.error("General error:", err);
      if (err instanceof Error) {
        if (err.message.includes("user rejected")) {
          alert("Transaction cancelled by user.");
        } else if (err.message.includes("could not decode result data")) {
          alert("Contract error: Function not found or contract deployed incorrectly!");
        } else {
          alert("Error: " + err.message);
        }
      } else {
        alert("Error: " + String(err));
      }
    }
  };

  return (
    <div className="bg-[#0a0718] flex flex-col items-center justify-start relative overflow-hidden p-4 pt-8 pb-8">
      {/* Enhanced Background Effects - Limited to game area */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMCAzNmMzLjMxNCAwIDYtMi42ODYgNi02cy0yLjY4Ni02LTYtNi02IDIuNjg2LTYgNiAyLjY4NiA2IDYgNnptMTgtMThjMy4zMTQgMCA2LTIuNjg2IDYtNnMtMi42ODYtNi02LTYtNiAyLjY4Ni02IDYgMi42ODYgNiA2IDZ6Ii8+PC9nPjwvc3ZnPg==')] opacity-5 animate-pulse"></div>
      
      {/* Floating particles in background */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-purple-400/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${i * 2}s`,
            animation: 'floatUp 20s infinite linear'
          }}
        />
      ))}
      
      {/* Ambient light orbs */}
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={`orb-${i}`}
          className="absolute w-20 h-20 rounded-full blur-xl opacity-10"
          style={{
            background: `radial-gradient(circle, ${['#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#06B6D4'][i]}, transparent)`,
            left: `${20 + i * 15}%`,
            top: `${30 + Math.sin(i) * 20}%`,
            animation: `float 8s ease-in-out infinite`,
            animationDelay: `${i * 1.6}s`
          }}
        />
      ))}

      {/* Arcade Cabinet Style Container with Grid Layout */}
      <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 p-3 md:p-4 rounded-[2rem] border-8 border-purple-900/50 shadow-[0_0_100px_rgba(168,85,247,0.3)] backdrop-blur-sm w-full max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-4 items-start min-h-[60vh] xl:min-h-[60vh]">
          {/* Game Section */}
          <div className="space-y-4">
            {/* 3D Spinning Monad Logo */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-30">
              <div className="scene">
                <div className="logo-wrapper">
                  <img src="/monad_logo.png" alt="Monad Logo Front" className="logo-front" />
                  <img src="/monad_logo.png" alt="Monad Logo Back" className="logo-back" />
                </div>
              </div>
            </div>

            {/* Game Title with Neon Effect */}
            <div className="text-center mb-4 relative">
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

            {/* Enhanced Game Screen Container with CRT Effect */}
            <div className="relative rounded-lg overflow-hidden border-[16px] border-slate-950 shadow-inner w-full crt-effect retro-glow">
              {/* Enhanced CRT Screen Effects */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black opacity-30"></div>
                <div className="absolute inset-0" style={{
                  backgroundImage: `
                    linear-gradient(transparent 50%, rgba(0, 255, 0, 0.05) 50%),
                    radial-gradient(circle at center, transparent 50%, rgba(0, 0, 0, 0.4) 100%)
                  `,
                  backgroundSize: '100% 4px, 100% 100%',
                }}></div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent animate-pulse"></div>
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

              {/* Enhanced Game Over Box Overlay - Positioned in Canvas Center */}
              {gameOver && (
                <div className="game-over-overlay absolute z-50 pointer-events-none animate-pulse" style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '550px',
                  height: '400px',
                  background: 'linear-gradient(135deg, #1a103c, #2d1b69)',
                  border: '4px solid #4c1d95',
                  borderRadius: '12px',
                  boxShadow: '0 0 60px rgba(168, 85, 247, 0.6), inset 0 0 60px rgba(168, 85, 247, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '28px',
                  imageRendering: 'pixelated'
                }}>
                  
                  {/* Enhanced Pixel Perfect Border with Glow */}
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: `
                      linear-gradient(to right, #4c1d95 0px, #4c1d95 3px, transparent 3px),
                      linear-gradient(to bottom, #4c1d95 0px, #4c1d95 3px, transparent 3px),
                      linear-gradient(to left, #6d28d9 0px, #6d28d9 3px, transparent 3px),
                      linear-gradient(to top, #6d28d9 0px, #6d28d9 3px, transparent 3px)
                    `,
                    backgroundSize: '100% 3px, 3px 100%, 100% 3px, 3px 100%',
                    backgroundPosition: 'top, right, bottom, left',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: '8px'
                  }}></div>
                  
                  {/* Enhanced Corner Pixels with Glow */}
                  <div className="absolute top-0 left-0 w-3 h-3 bg-purple-400 shadow-lg shadow-purple-500/50"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 bg-purple-400 shadow-lg shadow-purple-500/50"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 bg-purple-400 shadow-lg shadow-purple-500/50"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-purple-400 shadow-lg shadow-purple-500/50"></div>

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

                  {/* Enhanced Score Information Panel */}
                  <div className="relative w-full max-w-md mx-auto" style={{
                    background: 'linear-gradient(145deg, #1e1b4b, #312e81)',
                    border: '3px solid #6366f1',
                    borderRadius: '12px',
                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.3), inset 0 0 20px rgba(99, 102, 241, 0.1)',
                    imageRendering: 'pixelated'
                  }}>
                    {/* Enhanced Panel border pixels */}
                    <div className="absolute -top-1 -left-1 w-3 h-3 bg-slate-900 rounded-tl"></div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-slate-900 rounded-tr"></div>
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-slate-900 rounded-bl"></div>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-slate-900 rounded-br"></div>
                    
                    <div className="p-5 space-y-3 text-center relative z-10">
                      <div className="font-['Press_Start_2P'] text-lg" 
                           style={{ 
                             color: '#fef08a',
                             textShadow: '2px 2px 0px #000, 0 0 10px #fef08a',
                             imageRendering: 'pixelated'
                           }}>
                        CURRENT: {score}
                      </div>
                      
                      {getCurrentPlayerBest() > 0 && (
                        <div className="font-['Press_Start_2P'] text-sm" 
                             style={{ 
                               color: getNFTTier(getCurrentPlayerBest()).color,
                               textShadow: `2px 2px 0px #000, 0 0 8px ${getNFTTier(getCurrentPlayerBest()).color}`,
                               imageRendering: 'pixelated'
                             }}>
                          BEST: {getCurrentPlayerBest()}
                          {getCurrentPlayerBest() >= 750 && (
                            <div className="mt-2 text-xs" style={{
                              color: getNFTTier(getCurrentPlayerBest()).color,
                              textShadow: `1px 1px 0px #000, 0 0 6px ${getNFTTier(getCurrentPlayerBest()).color}`
                            }}>
                              ({getNFTTier(getCurrentPlayerBest()).tier} TIER)
                            </div>
                          )}
                        </div>
                      )}
                      
                      {score > getCurrentPlayerBest() && (
                        <div className="font-['Press_Start_2P'] text-sm animate-pulse" 
                             style={{ 
                               color: '#10b981',
                               textShadow: '2px 2px 0px #000, 0 0 10px #10b981',
                               imageRendering: 'pixelated'
                             }}>
                          🏆 NEW PERSONAL BEST! 🏆
                        </div>
                      )}
                      
                      {getCurrentPlayerBest() < 750 && (
                        <div className="font-['Press_Start_2P'] text-sm" 
                             style={{ 
                               color: '#f59e0b',
                               textShadow: '2px 2px 0px #000, 0 0 8px #f59e0b',
                               imageRendering: 'pixelated'
                             }}>
                          NEED 750+ FOR NFT!
                        </div>
                      )}
                      
                      {address && getCurrentPlayerBest() >= 750 && (
                        <div className="font-['Press_Start_2P'] text-xs mt-3 p-2 rounded" 
                             style={{ 
                               color: '#a78bfa',
                               textShadow: '1px 1px 0px #000',
                               backgroundColor: 'rgba(167, 139, 250, 0.1)',
                               border: '1px solid rgba(167, 139, 250, 0.3)',
                               imageRendering: 'pixelated'
                             }}>
                          WALLET: {address.slice(0, 8)}...{address.slice(-6)}
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

            {/* Game Controls and Stats with Enhanced Arcade Style */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-2 border-purple-500/30">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
                <p className="font-['Press_Start_2P'] text-base text-purple-300 mb-3 relative z-10 text-center">CONTROLS</p>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div className="px-4 py-3 bg-slate-900/80 rounded-lg border-2 border-purple-500/40 mb-2 transform hover:scale-105 transition-transform">
                      <span className="text-yellow-200 text-sm font-['Press_Start_2P']">SPACE</span>
                    </div>
                    <span className="text-purple-200 text-xs">JUMP</span>
                  </div>
                  <div className="text-center">
                    <div className="px-4 py-3 bg-slate-900/80 rounded-lg border-2 border-purple-500/40 mb-2 transform hover:scale-105 transition-transform">
                      <span className="text-yellow-200 text-sm font-['Press_Start_2P']">CLICK</span>
                    </div>
                    <span className="text-purple-200 text-xs">JUMP</span>
                  </div>
                </div>
              </div>
              
              <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-2 border-purple-500/30">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
                <p className="font-['Press_Start_2P'] text-base text-purple-300 mb-3 relative z-10 text-center">BEST SCORE</p>
                <div className="text-center">
                  <p className="text-3xl text-yellow-300 font-['Press_Start_2P'] relative z-10 mb-2">{getCurrentPlayerBest()}</p>
                  {getCurrentPlayerBest() >= 750 && (
                    <div className="inline-block px-3 py-1 rounded-full text-xs font-['Press_Start_2P']" 
                         style={{ 
                           backgroundColor: `${getNFTTier(getCurrentPlayerBest()).color}20`,
                           color: getNFTTier(getCurrentPlayerBest()).color,
                           border: `1px solid ${getNFTTier(getCurrentPlayerBest()).color}40`
                         }}>
                      {getNFTTier(getCurrentPlayerBest()).tier}
                    </div>
                  )}
                  {address && (
                    <p className="text-xs text-purple-200 mt-2 relative z-10 break-all">
                      {address.slice(0, 8)}...{address.slice(-6)}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 p-4 border-2 border-purple-500/30">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent"></div>
                <p className="font-['Press_Start_2P'] text-base text-purple-300 mb-3 relative z-10 text-center">GAME STATS</p>
                
                {/* Game Stats Grid */}
                <div className="grid grid-cols-2 gap-3 relative z-10">
                  <div className="text-center">
                    <p className="text-lg text-yellow-300 font-['Press_Start_2P']">{gameStatsRef.current.totalGamesPlayed}</p>
                    <p className="text-xs text-purple-300">GAMES</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg text-yellow-300 font-['Press_Start_2P']">{gameStatsRef.current.powerUpsCollected}</p>
                    <p className="text-xs text-purple-300">POWER-UPS</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg text-yellow-300 font-['Press_Start_2P']">{gameStatsRef.current.bestCombo}</p>
                    <p className="text-xs text-purple-300">BEST COMBO</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg text-yellow-300 font-['Press_Start_2P']">{gameStatsRef.current.candlesPassed}</p>
                    <p className="text-xs text-purple-300">CANDLES</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard Column - Right Side - Aligned with controls */}
          <div className="xl:sticky xl:top-8 xl:h-[calc(100vh-4rem)] flex flex-col justify-start">
            <div className="arcade-panel relative overflow-hidden rounded-lg bg-gradient-to-r from-yellow-800 to-yellow-900 p-6 border-2 border-yellow-500/30 h-full min-h-[600px] xl:min-h-[calc(75vh-8rem)] flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent"></div>
              
              {/* Enhanced Leaderboard Header */}
              <div className="text-center mb-6 relative z-10">
                <h3 className="font-['Press_Start_2P'] text-sm text-yellow-300 mb-2">🏆 HALL OF FAME</h3>
                <div className="flex justify-center items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-yellow-200">LIVE</span>
                  </div>
                  <div className="text-yellow-300">TOP {Math.min(leaderboard.length, 15)} PLAYERS</div>
                </div>
              </div>
              
              <div className="flex-1 space-y-3 relative z-10 overflow-y-auto pr-2 custom-scrollbar">
                {leaderboard.length > 0 ? (
                  leaderboard.slice(0, 15).map((entry, index) => ( // Show top 15
                    <div 
                      key={`${entry.address}-${entry.timestamp}`} 
                      className={`relative flex justify-between items-center p-4 rounded-lg border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                        address && entry.address.toLowerCase() === address.toLowerCase()
                          ? 'bg-gradient-to-r from-yellow-900/80 to-yellow-800/60 border-yellow-400/60 shadow-lg shadow-yellow-500/20'
                          : 'bg-gradient-to-r from-slate-900/80 to-slate-800/60 border-yellow-500/30 hover:border-yellow-400/50'
                      }`}
                    >
                      {/* Animated rank badge with enhanced effects */}
                      <div className="flex items-center gap-4">
                        <div className={`relative flex items-center justify-center w-10 h-10 rounded-full font-['Press_Start_2P'] text-xs transform transition-all duration-300 hover:scale-110 ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/50' : 
                          index === 1 ? 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 text-black shadow-lg shadow-gray-400/50' : 
                          index === 2 ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 text-white shadow-lg shadow-amber-600/50' : 
                          'bg-gradient-to-br from-slate-600 to-slate-800 text-gray-300'
                        }`}>
                          {index < 3 ? (
                            <span>
                              {index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span>{index + 1}</span>
                          )}
                          
                          {/* Crown glow effect for #1 */}
                          {index === 0 && (
                            <div className="absolute inset-0 rounded-full bg-yellow-400/30"></div>
                          )}
                        </div>
                        
                        {/* Player Info */}
                        <div className="flex flex-col gap-1">
                          <span className="text-white text-xs font-['Press_Start_2P']">
                            {entry.address.slice(0, 8)}...{entry.address.slice(-6)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-xs font-['Press_Start_2P'] px-2 py-1 rounded-full border"
                              style={{ 
                                color: getNFTTier(entry.score).color, 
                                backgroundColor: `${getNFTTier(entry.score).color}15`,
                                borderColor: `${getNFTTier(entry.score).color}40`
                              }}
                            >
                              {entry.tier}
                            </span>
                            {index < 3 && (
                              <span className="text-xs text-yellow-400">✨</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Enhanced score with pulse and formatting */}
                      <div className="text-right">
                        <div className={`text-sm font-['Press_Start_2P'] mb-1 transition-all duration-300 ${
                          index === 0 ? 'text-yellow-300 text-base' :
                          index === 1 ? 'text-gray-300 text-sm' :
                          index === 2 ? 'text-amber-600 text-sm' :
                          'text-yellow-300'
                        }`}>
                          {entry.score.toLocaleString()}
                          {index < 3 && <span className="ml-1">✨</span>}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </div>
                        
                        {/* Score trend indicator */}
                        {index === 0 && (
                          <div className="text-xs text-green-400">
                            🔥 TOP SCORE
                          </div>
                        )}
                      </div>
                      
                      {/* Highlight for current player */}
                      {address && entry.address.toLowerCase() === address.toLowerCase() && (
                        <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400/20 via-transparent to-yellow-400/20 rounded-lg blur-sm"></div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 text-xs font-['Press_Start_2P'] mt-8">
                    No scores yet. Be the first! 🚀
                  </div>
                )}
              </div>
              
              <div className="mt-6 pt-6 border-t-2 border-yellow-500/30 relative z-10 space-y-4">
                {/* Enhanced Refresh Button */}
                <button
                  onClick={fetchLeaderboard}
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-900/80 to-yellow-800/80 rounded-lg border-2 border-yellow-500/30 text-yellow-200 text-xs font-['Press_Start_2P'] hover:bg-gradient-to-r hover:from-yellow-800/80 hover:to-yellow-700/80 hover:border-yellow-400/50 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  🔄 REFRESH LEADERBOARD
                </button>
                
                {/* Enhanced Leaderboard Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-slate-900/40 rounded-lg border border-yellow-500/20">
                    <p className="text-sm text-yellow-300 font-['Press_Start_2P'] mb-1">
                      {leaderboard.length}
                    </p>
                    <p className="text-xs text-yellow-200">TOTAL PLAYERS</p>
                  </div>
                  
                  {address && (() => {
                    const playerRank = leaderboard.findIndex(entry => 
                      entry.address.toLowerCase() === address.toLowerCase()) + 1;
                    return (
                      <div className="text-center p-3 bg-slate-900/40 rounded-lg border border-yellow-500/20">
                        <p className="text-sm text-yellow-300 font-['Press_Start_2P'] mb-1">
                          {playerRank > 0 ? `#${playerRank}` : '--'}
                        </p>
                        <p className="text-xs text-yellow-200">YOUR RANK</p>
                      </div>
                    );
                  })()}
                  
                  {!address && (
                    <div className="text-center p-3 bg-slate-900/40 rounded-lg border border-yellow-500/20">
                      <p className="text-sm text-gray-400 font-['Press_Start_2P'] mb-1">--</p>
                      <p className="text-xs text-gray-400">CONNECT WALLET</p>
                    </div>
                  )}
                </div>
                
                {/* Leaderboard Info */}
                <div className="text-center space-y-2">
                  <p className="text-xs text-yellow-300 font-['Press_Start_2P']">
                    🎯 MINIMUM SCORE FOR NFT: 750
                  </p>
                  <p className="text-xs text-gray-400">
                    Score updates automatically when you beat your record
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Status Messages */}
        <div className="text-center mt-4 mb-16">
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
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
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

      {/* Enhanced Animation Keyframes and Styles */}
      <style>{`
        /* Enhanced Scrollbar Animation */
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #facc15, #eab308);
          border-radius: 4px;
          border: 1px solid rgba(234, 179, 8, 0.3);
          transition: all 0.3s ease;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #fde047, #facc15);
          box-shadow: 0 0 10px rgba(234, 179, 8, 0.5);
        }
        
        /* Enhanced Button Hover Effects */
        .arcade-button {
          position: relative;
          overflow: hidden;
        }
        
        .arcade-button::before {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(45deg, transparent, rgba(168, 85, 247, 0.3), transparent);
          z-index: -1;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .arcade-button:hover::before {
          opacity: 1;
        }
        
        /* Breathing background animation */
        @keyframes backgroundPulse {
          0%, 100% { 
            background-size: 100% 100%;
            filter: hue-rotate(0deg);
          }
          50% { 
            background-size: 110% 110%;
            filter: hue-rotate(5deg);
          }
        }
        
        /* Floating elements */
        @keyframes floatUp {
          0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.7;
          }
          90% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
          }
        }
        
        /* Enhanced particle effects */
        @keyframes particleFloat {
          0% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-50px) scale(0.5);
            opacity: 0;
          }
        }
        
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
        
        @keyframes leaderboardEntry {
          0% { transform: translateX(-20px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes digitalFlicker {
          0%, 100% { opacity: 1; }
          98% { opacity: 1; }
          99% { opacity: 0.95; }
        }
        
        /* 3D Logo Animation Styles */
        .scene {
          width: 140px;
          height: 140px;
          perspective: 1000px;
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
          width: 100px;
          height: 100px;
          margin: -50px 0 0 -50px;
          backface-visibility: hidden;
          border-radius: 50%;
          box-shadow: 0 0 30px rgba(168, 85, 247, 0.6);
        }
        
        .logo-back {
          transform: rotateY(180deg);
        }
        
        .arcade-panel {
          position: relative;
          overflow: hidden;
          animation: digitalFlicker 3s infinite;
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
          animation: shine 4s infinite linear;
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
        
        .retro-glow {
          box-shadow: 
            0 0 10px rgba(168, 85, 247, 0.3),
            inset 0 0 10px rgba(168, 85, 247, 0.1);
        }
        
        /* Enhanced CRT Effects */
        .crt-effect {
          position: relative;
        }
        
        .crt-effect::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            transparent 50%,
            rgba(0, 255, 0, 0.03) 50%
          );
          background-size: 100% 4px;
          pointer-events: none;
          animation: scanline 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default FlappyBTCChart;
