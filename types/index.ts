// Server-only (full listing with price)
export interface HouseListing {
  id: string;
  actualPrice: number;
  address: string;
  city: string;
  state: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotSizeSqft: number;
  photos: string[];
  neighborhood?: string;
}

// Sent to client (price stripped)
export type PublicHouse = Omit<HouseListing, 'actualPrice'>;

export interface GuessResult {
  houseId: string;
  guessedPrice: number;
  actualPrice: number;
  score: number;        // 0–1000
  percentOff: number;   // e.g. 0.12 = 12%
  direction: 'over' | 'under' | 'exact';
}

export interface GameState {
  version: number;
  gameDate: string;       // "2025-03-18"
  gameNumber: number;
  houseIds: string[];
  currentHouseIndex: number;
  guesses: GuessResult[];
  phase: 'loading' | 'guessing' | 'revealing' | 'between' | 'complete' | 'already_played';
  totalScore: number;
}

// API shapes
export interface GuessRequest {
  houseId: string;
  gameDate: string;
  guessedPrice: number;
}

export interface GuessResponse {
  actualPrice: number;
  score: number;
  percentOff: number;
  direction: string;
}

export interface DailyResponse {
  gameDate: string;
  gameNumber: number;
  houses: PublicHouse[];
}
