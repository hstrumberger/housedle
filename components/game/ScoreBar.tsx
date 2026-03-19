'use client';

import { motion } from 'framer-motion';

interface ScoreBarProps {
  score: number; // 0–1000
}

function barColor(score: number): string {
  if (score >= 900) return 'bg-green-500';
  if (score >= 700) return 'bg-yellow-400';
  if (score >= 500) return 'bg-orange-400';
  if (score >= 300) return 'bg-red-500';
  return 'bg-gray-500';
}

function gradeLabel(score: number): string {
  if (score >= 900) return 'Incredible!';
  if (score >= 700) return 'Great!';
  if (score >= 500) return 'Not bad';
  if (score >= 300) return 'Way off';
  return 'Ouch';
}

export default function ScoreBar({ score }: ScoreBarProps) {
  const pct = (score / 1000) * 100;
  const color = barColor(score);

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">Accuracy</span>
        <motion.span
          className="font-bold text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {score}/1000
        </motion.span>
      </div>
      <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        />
      </div>
      <motion.p
        className="text-center text-sm font-semibold text-gray-300"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.0, type: 'spring', stiffness: 200 }}
      >
        {gradeLabel(score)}
      </motion.p>
    </div>
  );
}
