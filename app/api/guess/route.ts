import { NextRequest, NextResponse } from 'next/server';
import { houses, allHouseIds } from '@/data/houses';
import { selectDailyHouses, todayDateStr } from '@/lib/dailySeed';
import { scoreGuess } from '@/lib/scoring';
import { GuessRequest, GuessResponse } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: GuessRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { houseId, gameDate, guessedPrice } = body;

  if (!houseId || !gameDate || typeof guessedPrice !== 'number') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Validate date is within 1 day of server date
  const serverToday = todayDateStr();
  const serverMs = new Date(serverToday + 'T00:00:00Z').getTime();
  const clientMs = new Date(gameDate + 'T00:00:00Z').getTime();
  if (Math.abs(serverMs - clientMs) > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Invalid game date' }, { status: 400 });
  }

  // Use client's gameDate to derive their house set
  const dailyIds = selectDailyHouses(gameDate, allHouseIds);
  if (!dailyIds.includes(houseId)) {
    return NextResponse.json({ error: 'House not in todays set' }, { status: 400 });
  }

  const house = houses.find((h) => h.id === houseId);
  if (!house) {
    return NextResponse.json({ error: 'House not found' }, { status: 404 });
  }

  const result = scoreGuess(houseId, guessedPrice, house.actualPrice);

  const response: GuessResponse = {
    actualPrice: house.actualPrice,
    score: result.score,
    percentOff: result.percentOff,
    direction: result.direction,
  };

  return NextResponse.json(response);
}
