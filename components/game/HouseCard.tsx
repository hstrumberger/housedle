'use client';

import { PublicHouse } from '@/types';
import { formatNumber } from '@/lib/formatters';
import PhotoCarousel from './PhotoCarousel';

interface HouseCardProps {
  house: PublicHouse;
  houseNumber: number;
  totalHouses: number;
}

export default function HouseCard({ house, houseNumber, totalHouses }: HouseCardProps) {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-400">
          House {houseNumber} of {totalHouses}
        </p>
        <p className="text-sm text-gray-500">#{houseNumber}</p>
      </div>

      <PhotoCarousel photos={house.photos} city={house.city} />

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">{house.address}</h2>
        <p className="text-gray-400">
          {house.city}, {house.state}
          {house.neighborhood && <span className="text-gray-500"> · {house.neighborhood}</span>}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Beds" value={house.beds > 0 ? house.beds.toString() : 'N/A'} />
        <Stat label="Baths" value={house.baths > 0 ? house.baths.toString() : 'N/A'} />
        <Stat label="Sq ft" value={house.sqft > 0 ? formatNumber(house.sqft) : 'N/A'} />
      </div>

      <div className="text-sm text-gray-500">
        Lot: {house.lotSizeSqft > 0 ? `${formatNumber(house.lotSizeSqft)} sq ft` : 'N/A'}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-white font-semibold">{value}</p>
    </div>
  );
}
