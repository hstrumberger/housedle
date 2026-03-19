'use client';

import { motion } from 'framer-motion';
import { GuessResult } from '@/types';
import { scoreEmoji } from '@/lib/scoring';

interface ProgressDotsProps {
  total: number;
  currentIndex: number;
  guesses: GuessResult[];
}

export default function ProgressDots({ total, currentIndex, guesses }: ProgressDotsProps) {
  return (
    <div className="flex gap-2 items-center justify-center">
      {Array.from({ length: total }).map((_, i) => {
        const guess = guesses[i];
        const isCurrent = i === currentIndex;
        const isCompleted = i < guesses.length;

        return (
          <motion.div
            key={i}
            className={`flex items-center justify-center rounded-full transition-all ${
              isCompleted
                ? 'w-8 h-8 text-sm'
                : isCurrent
                ? 'w-4 h-4 bg-green-400'
                : 'w-3 h-3 bg-gray-600'
            }`}
            animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {isCompleted && guess ? scoreEmoji(guess.score) : null}
          </motion.div>
        );
      })}
    </div>
  );
}
