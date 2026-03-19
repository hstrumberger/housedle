import { GuessResult } from '@/types';

export function scoreGuess(
  houseId: string,
  guessedPrice: number,
  actualPrice: number
): GuessResult {
  const percentOff = Math.abs(guessedPrice - actualPrice) / actualPrice;
  const k = Math.LN2 / 0.25;
  const score = Math.round(1000 * Math.exp(-k * percentOff));
  const direction: GuessResult['direction'] =
    guessedPrice > actualPrice ? 'over' : guessedPrice < actualPrice ? 'under' : 'exact';
  return { houseId, guessedPrice, actualPrice, score, percentOff, direction };
}

// Emoji tier for share text
export function scoreEmoji(score: number): string {
  if (score >= 900) return '🟩';
  if (score >= 700) return '🟨';
  if (score >= 500) return '🟧';
  if (score >= 300) return '🟥';
  return '⬛';
}
