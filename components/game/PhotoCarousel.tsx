'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoCarouselProps {
  photos: string[];
  city: string;
}

export default function PhotoCarousel({ photos, city }: PhotoCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState(1);

  function go(newIdx: number, dir: number) {
    setDirection(dir);
    setIdx(newIdx);
  }

  if (photos.length === 0) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-gray-900 flex items-center justify-center"
        style={{ aspectRatio: '16/9' }}
      >
        <p className="text-gray-600 text-sm">No photo available</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gray-900" style={{ aspectRatio: '16/9' }}>
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={idx}
          custom={direction}
          variants={{
            enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <Image
            src={photos[idx]}
            alt={`${city} home photo ${idx + 1}`}
            fill
            className="object-cover"
            priority={idx === 0}
            unoptimized
          />
        </motion.div>
      </AnimatePresence>

      {/* Arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={() => go((idx - 1 + photos.length) % photos.length, -1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            onClick={() => go((idx + 1) % photos.length, 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full w-9 h-9 flex items-center justify-center transition-colors"
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}

      {/* Dots */}
      {photos.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i, i > idx ? 1 : -1)}
              className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/40'}`}
              aria-label={`Photo ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
