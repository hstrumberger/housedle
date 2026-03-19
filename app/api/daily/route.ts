import { NextResponse } from 'next/server';
import { houses, allHouseIds } from '@/data/houses';
import { selectDailyHouses, getGameNumber, todayDateStr } from '@/lib/dailySeed';
import { DailyResponse, PublicHouse } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  const today = todayDateStr();
  const houseIds = selectDailyHouses(today, allHouseIds);
  const gameNumber = getGameNumber(today);

  const publicHouses: PublicHouse[] = houseIds.map((id) => {
    const house = houses.find((h) => h.id === id)!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { actualPrice, ...publicHouse } = house;
    return publicHouse;
  });

  const response: DailyResponse = {
    gameDate: today,
    gameNumber,
    houses: publicHouses,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
