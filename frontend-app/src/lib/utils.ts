import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build a URL to a file on the backend's public storage disk.
 *
 * VITE_API_URL points at the API base (which includes the `/api` suffix, e.g.
 * `https://api.example.com/api`). Public files are served from the backend
 * root at `/storage/...`, NOT under `/api`, so we strip a trailing `/api`
 * to get the backend origin before appending the storage path.
 */
export function backendOrigin(): string {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '';
  const origin = apiBase.replace(/\/api\/?$/, '');
  return origin || 'http://localhost:8000';
}

export function storageUrl(path?: string | null): string {
  if (!path) return '';
  return `${backendOrigin()}/storage/${path}`;
}

export function compressImageToWebp(file: File, maxWidth = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context is null'));
        
        ctx.drawImage(img, 0, 0, width, height);
        const webpDataUrl = canvas.toDataURL('image/webp', quality);
        resolve(webpDataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function formatItemNote(noteText: string | null | undefined, menuName: string | undefined): string {
  if (!noteText) return '';
  const isBakso = menuName?.toLowerCase().includes('bakso');
  if (!isBakso) {
    // Remove "Kuah: " or "Variasi: " prefix for non-bakso menus
    return noteText.replace(/^(?:Kuah|Variasi):\s*/i, '');
  }
  return noteText;
}

// Item gratis hasil tukar poin reward — note-nya diberi penanda "Bonus Tukar X Poin" oleh kasir (POS).
export function isBonusItemNote(noteText: string | null | undefined): boolean {
  return /\bBonus Tukar\s*\d*\s*Poin\b/i.test(noteText || '');
}

