// mulberry32 seeded PRNG — pure function, same output in Node + browser

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EPOCH = new Date('2025-01-01T00:00:00Z').getTime();

export function getGameNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  return Math.floor((d - EPOCH) / (1000 * 60 * 60 * 24));
}

export function selectDailyHouses(dateStr: string, allIds: string[]): string[] {
  const gameNumber = getGameNumber(dateStr);
  return seededShuffle(allIds, gameNumber).slice(0, 5);
}

export function todayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}
