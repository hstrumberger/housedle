'use client';

import { motion } from 'framer-motion';
import { GuessResult } from '@/types';
import { formatPrice, formatPercent } from '@/lib/formatters';
import ScoreBar from './ScoreBar';

interface RevealPanelProps {
  result: GuessResult;
  isLastHouse: boolean;
  onNext: () => void;
}

export default function RevealPanel({ result, isLastHouse, onNext }: RevealPanelProps) {
  const { guessedPrice, actualPrice, score, percentOff, direction } = result;

  return (
    <div className="w-full space-y-6">
      {/* Actual price fade-in */}
      <motion.div
        className="text-center space-y-1"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-sm text-gray-400">Actual Price</p>
        <p className="text-4xl font-bold text-white">{formatPrice(actualPrice)}</p>
      </motion.div>

      {/* Guess comparison */}
      <motion.div
        className="flex justify-between items-center bg-gray-800 rounded-xl p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Your Guess</p>
          <p className="text-lg font-semibold text-gray-200">{formatPrice(guessedPrice)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Difference</p>
          <p className={`text-lg font-semibold ${direction === 'exact' ? 'text-green-400' : direction === 'over' ? 'text-red-400' : 'text-blue-400'}`}>
            {direction === 'exact' ? 'Exact!' : `${direction === 'over' ? '↑' : '↓'} ${formatPercent(percentOff)}`}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">Score</p>
          <p className="text-lg font-semibold text-white">{score}</p>
        </div>
      </motion.div>

      {/* Animated score bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <ScoreBar score={score} />
      </motion.div>

      {/* Next button slide-up */}
      <motion.button
        onClick={onNext}
        className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-4 rounded-xl text-lg transition-colors"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 200 }}
      >
        {isLastHouse ? 'See Results' : 'Next House →'}
      </motion.button>
    </div>
  );
}
