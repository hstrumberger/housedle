'use client';

import { useState, useCallback } from 'react';
import { formatPrice } from '@/lib/formatters';

const LOG_MIN = Math.log10(50_000);
const LOG_MAX = Math.log10(10_000_000);
// Default: geometric mean = $707,107
const DEFAULT_SLIDER = ((Math.log10(707_107) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;

function sliderToPrice(pos: number): number {
  return Math.round(10 ** (LOG_MIN + (pos / 100) * (LOG_MAX - LOG_MIN)));
}

function priceToSlider(price: number): number {
  const clamped = Math.max(50_000, Math.min(10_000_000, price));
  return ((Math.log10(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
}

interface GuessInputProps {
  onSubmit: (price: number) => void;
  disabled?: boolean;
}

export default function GuessInput({ onSubmit, disabled }: GuessInputProps) {
  const [sliderPos, setSliderPos] = useState(DEFAULT_SLIDER);
  const [inputText, setInputText] = useState('');
  const [inputError, setInputError] = useState('');

  const currentPrice = inputText
    ? parseInt(inputText.replace(/\D/g, ''), 10) || sliderToPrice(sliderPos)
    : sliderToPrice(sliderPos);

  const handleSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = parseFloat(e.target.value);
    setSliderPos(pos);
    setInputText('');
    setInputError('');
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInputText(raw);
    setInputError('');
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num >= 50_000 && num <= 10_000_000) {
      setSliderPos(priceToSlider(num));
    }
  }, []);

  const handleSubmit = () => {
    const price = currentPrice;
    if (price < 50_000 || price > 10_000_000) {
      setInputError('Price must be between $50,000 and $10,000,000');
      return;
    }
    onSubmit(price);
  };

  return (
    <div className="w-full space-y-5">
      {/* Price display */}
      <div className="text-center">
        <p className="text-4xl font-bold text-white tabular-nums">
          {formatPrice(currentPrice)}
        </p>
        <p className="text-sm text-gray-400 mt-1">Your guess</p>
      </div>

      {/* Logarithmic slider */}
      <div className="px-1">
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={sliderPos}
          onChange={handleSlider}
          disabled={disabled}
          className="w-full h-2 appearance-none rounded-full bg-gray-700 accent-green-400 cursor-pointer disabled:opacity-50"
          aria-label="Price slider"
        />

      </div>

      {/* Manual text input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={inputText ? parseInt(inputText, 10).toLocaleString() : ''}
            onChange={handleTextChange}
            placeholder={currentPrice.toLocaleString()}
            disabled={disabled}
            className="w-full bg-gray-800 border border-gray-600 rounded-xl pl-7 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors disabled:opacity-50"
            aria-label="Price text input"
          />
        </div>
      </div>

      {inputError && <p className="text-red-400 text-sm text-center">{inputError}</p>}

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg transition-colors"
      >
        Submit Guess
      </button>
    </div>
  );
}
