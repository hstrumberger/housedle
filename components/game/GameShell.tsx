'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameState, PublicHouse, GuessResult, DailyResponse, GuessResponse } from '@/types';
import { loadGameState, saveGameState } from '@/lib/gameState';
import HouseCard from './HouseCard';
import GuessInput from './GuessInput';
import RevealPanel from './RevealPanel';
import ProgressDots from './ProgressDots';
import ResultsSummary from './ResultsSummary';

const TOTAL_HOUSES = 5;

export default function GameShell() {
  const [mounted, setMounted] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [houses, setHouses] = useState<PublicHouse[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);

  // Hydration guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load game on mount
  useEffect(() => {
    if (!mounted) return;

    async function init() {
      try {
        const res = await fetch('/api/daily');
        if (!res.ok) throw new Error('Failed to load daily houses');
        const daily: DailyResponse = await res.json();

        const saved = loadGameState();
        const today = daily.gameDate;

        // Check if we have a valid saved state for today
        if (saved && saved.gameDate === today) {
          setHouses(daily.houses);
          if (saved.phase === 'complete') {
            setGameState({ ...saved, phase: 'already_played' });
          } else {
            setGameState(saved);
          }
          return;
        }

        // Fresh game
        const freshState: GameState = {
          version: 1,
          gameDate: today,
          gameNumber: daily.gameNumber,
          houseIds: daily.houses.map((h) => h.id),
          currentHouseIndex: 0,
          guesses: [],
          phase: 'guessing',
          totalScore: 0,
        };
        setHouses(daily.houses);
        setGameState(freshState);
        saveGameState(freshState);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    }

    init();
  }, [mounted]);

  const handleGuess = useCallback(
    async (guessedPrice: number) => {
      if (!gameState || isSubmitting) return;
      const currentHouse = houses[gameState.currentHouseIndex];
      if (!currentHouse) return;

      setIsSubmitting(true);
      setError(null);

      // Transition to revealing immediately, POST fires simultaneously
      const revealingState: GameState = { ...gameState, phase: 'revealing' };
      setGameState(revealingState);

      try {
        const res = await fetch('/api/guess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            houseId: currentHouse.id,
            gameDate: gameState.gameDate,
            guessedPrice,
          }),
        });

        if (!res.ok) throw new Error('Failed to submit guess');
        const data: GuessResponse = await res.json();

        const result: GuessResult = {
          houseId: currentHouse.id,
          guessedPrice,
          actualPrice: data.actualPrice,
          score: data.score,
          percentOff: data.percentOff,
          direction: data.direction as GuessResult['direction'],
        };

        const newGuesses = [...gameState.guesses, result];
        const newTotal = newGuesses.reduce((sum, g) => sum + g.score, 0);

        const newState: GameState = {
          ...gameState,
          guesses: newGuesses,
          totalScore: newTotal,
          phase: 'revealing',
        };
        setGameState(newState);
        saveGameState(newState);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to submit guess');
        setGameState(gameState); // revert to guessing
      } finally {
        setIsSubmitting(false);
      }
    },
    [gameState, houses, isSubmitting]
  );

  const handleNext = useCallback(() => {
    if (!gameState) return;
    const nextIndex = gameState.currentHouseIndex + 1;
    const isLast = nextIndex >= TOTAL_HOUSES;

    const newState: GameState = {
      ...gameState,
      currentHouseIndex: isLast ? gameState.currentHouseIndex : nextIndex,
      phase: isLast ? 'complete' : 'guessing',
    };
    setGameState(newState);
    saveGameState(newState);
  }, [gameState]);

  // Pre-mount: nothing (avoid hydration mismatch)
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-lg">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gray-700 text-white px-6 py-2 rounded-lg hover:bg-gray-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-lg animate-pulse">Loading today&apos;s houses…</div>
      </div>
    );
  }

  const currentHouse = houses[gameState.currentHouseIndex];
  const lastGuess = gameState.guesses[gameState.currentHouseIndex];
  const isLastHouse = gameState.currentHouseIndex === TOTAL_HOUSES - 1;

  const isAlreadyPlayed = gameState.phase === 'already_played';
  const isComplete = gameState.phase === 'complete' || isAlreadyPlayed;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between max-w-lg mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-green-400">House</span>dle
        </h1>
        <button
          onClick={() => setShowHowTo(true)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          How to Play
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Progress dots */}
        <ProgressDots
          total={TOTAL_HOUSES}
          currentIndex={gameState.currentHouseIndex}
          guesses={gameState.guesses}
        />

        {/* Already played banner */}
        {isAlreadyPlayed && (
          <div className="bg-yellow-900/40 border border-yellow-700 rounded-xl p-3 text-center text-yellow-200 text-sm">
            You already played today! Here are your results.
          </div>
        )}

        <AnimatePresence mode="wait">
          {isComplete ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <ResultsSummary state={gameState} houses={houses} />
            </motion.div>
          ) : (
            <motion.div
              key={`house-${gameState.currentHouseIndex}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {currentHouse && (
                <HouseCard
                  house={currentHouse}
                  houseNumber={gameState.currentHouseIndex + 1}
                  totalHouses={TOTAL_HOUSES}
                />
              )}

              {gameState.phase === 'guessing' && (
                <GuessInput onSubmit={handleGuess} disabled={isSubmitting} />
              )}

              {(gameState.phase === 'revealing' || gameState.phase === 'between') && lastGuess && (
                <RevealPanel
                  result={lastGuess}
                  isLastHouse={isLastHouse}
                  onNext={handleNext}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* How to Play modal */}
      <AnimatePresence>
        {showHowTo && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHowTo(false)}
          >
            <motion.div
              className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold">How to Play</h2>
              <ul className="space-y-2 text-gray-300 text-sm">
                <li>🏠 You&apos;ll see <strong>5 house listings</strong> today</li>
                <li>💰 Guess the <strong>listing price</strong> of each home</li>
                <li>📊 Use the slider or type in a price</li>
                <li>🎯 Closer = more points (max 1,000 per house)</li>
                <li>🔄 Same houses for <strong>everyone</strong> each day</li>
              </ul>
              <div className="space-y-1 text-sm">
                <p className="text-gray-400 font-medium">Scoring:</p>
                <p>🟩 ≥900 &nbsp; 🟨 ≥700 &nbsp; 🟧 ≥500 &nbsp; 🟥 ≥300 &nbsp; ⬛ &lt;300</p>
              </div>
              <button
                onClick={() => setShowHowTo(false)}
                className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Let&apos;s Play!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
