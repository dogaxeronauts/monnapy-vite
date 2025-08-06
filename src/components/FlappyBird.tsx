"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";

const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const BIRD_X = 80;
const BIRD_RADIUS = 12;
const GROUND_HEIGHT = 60;
const GRAVITY = 0.2;
const JUMP_FORCE = -7;
const CANDLE_INTERVAL = 1500;
const MIN_GAP = 140;

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

const FlappyBTCChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const birdYRef = useRef(GAME_HEIGHT / 2);
  const velocityRef = useRef(0);
  const candlesRef = useRef<Candle[]>([]);
  const rugPullsRef = useRef<RugPull[]>([]);
  const lastCandleRef = useRef(Date.now());
  const animationRef = useRef<number>();

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const resetGame = () => {
    setScore(100);
    setGameOver(false);
    setGameStarted(false);
    birdYRef.current = GAME_HEIGHT / 2;
    velocityRef.current = 0;
    candlesRef.current = [];
    rugPullsRef.current = [];
    lastCandleRef.current = Date.now();
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

    const draw = () => {
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Background
      ctx.fillStyle = "#1e1b4b";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Ground
      ctx.fillStyle = "#2e1065";
      ctx.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);

      // Candles
      candlesRef.current.forEach((c) => {
        const color = c.type === "green" ? "#22c55e" : "#ef4444";
        const wickColor = "#a78bfa";
        const centerX = c.x + c.width / 2;

        ctx.strokeStyle = wickColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, c.low);
        ctx.lineTo(centerX, c.high);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillRect(c.x, 0, c.width, c.low);
        ctx.fillRect(c.x, c.high, c.width, GAME_HEIGHT - GROUND_HEIGHT - c.high);
      });

      // RUG PULLS
      rugPullsRef.current.forEach((r) => {
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.arc(r.x, r.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "10px monospace";
        ctx.fillText("RUG", r.x - 10, r.y + 4);
      });

      // Bird
      const birdY = birdYRef.current;
      const gradient = ctx.createRadialGradient(BIRD_X, birdY, 4, BIRD_X, birdY, BIRD_RADIUS);
      gradient.addColorStop(0, "#fef08a");
      gradient.addColorStop(1, "#facc15");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(BIRD_X, birdY, BIRD_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Score
      ctx.fillStyle = "#e0e7ff";
      ctx.font = "18px JetBrains Mono";
      ctx.textAlign = "center";
      ctx.fillText(`Blocks Verified: ${score}`, GAME_WIDTH / 2, 32);

      // Game over
      if (gameOver) {
        ctx.fillStyle = "#000000aa";
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = "white";
        ctx.font = "24px JetBrains Mono";
        ctx.fillText("Chain Broken", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
        ctx.font = "14px JetBrains Mono";
        ctx.fillText("Click or press Space to restart", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
      }

      if (!gameStarted && !gameOver) {
        ctx.fillStyle = "#ffffffbb";
        ctx.font = "16px JetBrains Mono";
        ctx.fillText("Click or press Space to begin", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
      }
    };

    const gameLoop = () => {
      const now = Date.now();

      if (!gameStarted) {
        birdYRef.current = GAME_HEIGHT / 2;
        draw();
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (!gameOver) {
        velocityRef.current += GRAVITY;
        birdYRef.current += velocityRef.current;

        if (now - lastCandleRef.current > CANDLE_INTERVAL) {
          spawnCandle();
          lastCandleRef.current = now;
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

        // Candle collision
        for (const c of candlesRef.current) {
          const hitX = BIRD_X + BIRD_RADIUS > c.x && BIRD_X - BIRD_RADIUS < c.x + c.width;
          const hitY = birdYRef.current < c.low || birdYRef.current > c.high;
          if (hitX && hitY) {
            setGameOver(true);
          }
        }

        // Rug pull collision
        for (const r of rugPullsRef.current) {
          const dx = r.x - BIRD_X;
          const dy = r.y - birdYRef.current;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < BIRD_RADIUS + 14) {
            setGameOver(true);
          }
        }

        if (
          gameStarted &&
          (birdYRef.current + BIRD_RADIUS > GAME_HEIGHT - GROUND_HEIGHT ||
           birdYRef.current < BIRD_RADIUS)
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
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        onClick={flap}
        tabIndex={0}
        className="border-4 border-purple-700 rounded-xl shadow-lg outline-none"
      />
      <p className="text-purple-300 font-mono text-xs mt-2">
        BTC chart protocol active. Click or press Space to begin.
      </p>
    </div>
  );
};

export default FlappyBTCChart;
