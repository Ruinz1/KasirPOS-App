import { useState, useEffect } from 'react';

/**
 * Hook untuk menghitung elapsed time pesanan sejak `createdAt`.
 * Returns total detik yang sudah berlalu, update tiap detik.
 */
export function useOrderElapsed(createdAt: string): number {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  );

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  return elapsed;
}

/**
 * Format detik menjadi string "MM:SS"
 */
export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Ambil class warna timer berdasarkan elapsed (dalam menit):
 *  - < 10 menit  → hijau
 *  - 10–15 menit → kuning
 *  - > 15 menit  → merah (+ pulse class untuk animasi)
 */
export function getElapsedColorClass(seconds: number): string {
  const minutes = seconds / 60;
  if (minutes >= 15) return 'text-red-500 animate-pulse font-black';
  if (minutes >= 10) return 'text-yellow-500 font-bold';
  return 'text-green-600 font-semibold';
}

/**
 * Apakah pesanan sudah masuk zone urgen (> 15 menit)?
 */
export function isUrgent(seconds: number): boolean {
  return seconds >= 15 * 60;
}

/**
 * Apakah pesanan sudah masuk zone warning (10–15 menit)?
 */
export function isWarning(seconds: number): boolean {
  return seconds >= 10 * 60 && seconds < 15 * 60;
}
