'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { GameState, PublicHouse } from '@/types';
import { formatPrice } from '@/lib/formatters';
import { scoreEmoji } from '@/lib/scoring';
import { buildShareText, copyShareText } from '@/lib/share';

interface ResultsSummaryProps {
  state: GameState;
  houses: PublicHouse[];
}

export default function ResultsSummary({ state, houses }: ResultsSummaryProps) {
  const [copied, setCopied] = useState(false);

  const shareHouses = state.guesses.map((_, i) => ({
    city: houses[i]?.city ?? '',
    state: houses[i]?.state ?? '',
  }));

  async function handleShare() {
    const text = buildShareText(state, shareHouses);
    await copyShareText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const avg = Math.round(state.totalScore / state.guesses.length);

  return (
    <div className="w-full space-y-6">
      <motion.div
        className="text-center space-y-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl font-bold text-white">Game Over!</h2>
        <p className="text-gray-400">Housedle #{state.gameNumber}</p>
      </motion.div>

      {/* Total score */}
      <motion.div
        className="bg-gray-800 rounded-2xl p-6 text-center space-y-1"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-gray-400 text-sm">Total Score</p>
        <p className="text-5xl font-bold text-green-400">{state.totalScore.toLocaleString()}</p>
        <p className="text-gray-500 text-sm">out of 5,000 · avg {avg}/1000 per house</p>
      </motion.div>

      {/* Per-house breakdown */}
      <div className="space-y-2">
        {state.guesses.map((g, i) => {
          const h = houses[i];
          return (
            <motion.div
              key={g.houseId}
              className="flex items-center gap-3 bg-gray-800 rounded-xl p-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <span className="text-xl">{scoreEmoji(g.score)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {h?.city}, {h?.state}
                </p>
                <p className="text-xs text-gray-400">
                  Guessed {formatPrice(g.guessedPrice)} · Actual {formatPrice(g.actualPrice)}
                </p>
              </div>
              <span className="text-white font-semibold text-sm">{g.score}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Share button */}
      <motion.button
        onClick={handleShare}
        className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-4 rounded-xl text-lg transition-colors"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        {copied ? '✓ Copied!' : '📋 Share Results'}
      </motion.button>

      <motion.p
        className="text-center text-gray-500 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Come back tomorrow for a new set of houses!
      </motion.p>
    </div>
  );
}
