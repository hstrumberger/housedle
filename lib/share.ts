import { GameState, GuessResult } from '@/types';
import { scoreEmoji } from './scoring';

function directionArrow(direction: string, percentOff: number): string {
  if (direction === 'exact') return '=';
  const pct = Math.round(percentOff * 100);
  return direction === 'over' ? `↑${pct}%` : `↓${pct}%`;
}

export function buildShareText(
  state: GameState,
  houses: Array<{ city: string; state: string }>
): string {
  const dateObj = new Date(state.gameDate + 'T00:00:00Z');
  const formatted = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const emojiRow = state.guesses.map((g) => scoreEmoji(g.score)).join('');

  const lines = state.guesses.map((g: GuessResult, i: number) => {
    const h = houses[i];
    const emoji = scoreEmoji(g.score);
    const dir = directionArrow(g.direction, g.percentOff);
    return `${emoji} ${h.city}, ${h.state} — ${dir}`;
  });

  return [
    `Housedle #${state.gameNumber} — ${formatted}`,
    `Score: ${state.totalScore.toLocaleString()}/5000`,
    '',
    emojiRow,
    '',
    ...lines,
    '',
    'Play at housedle.vercel.app',
  ].join('\n');
}

export async function copyShareText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  }
}
