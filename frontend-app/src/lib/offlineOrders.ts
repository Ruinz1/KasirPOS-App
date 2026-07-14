import api from '@/lib/api';

/**
 * Antrian transaksi offline untuk POS (PWA).
 * Saat POST /orders gagal karena jaringan, payload disimpan di localStorage
 * lalu dikirim ulang otomatis begitu koneksi kembali.
 */

const STORAGE_KEY = 'kedaipos_offline_orders';

export interface OfflineOrder {
  id: string;
  payload: Record<string, unknown>;
  queued_at: string;
}

export function isNetworkError(error: unknown): boolean {
  const err = error as { response?: unknown; request?: unknown } | null;
  return !!err && typeof err === 'object' && 'request' in err && !err.response;
}

export function getOfflineOrders(): OfflineOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineOrder[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineOrders(orders: OfflineOrder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent('offline-orders-changed'));
}

export function getOfflineOrderCount(): number {
  return getOfflineOrders().length;
}

export function queueOfflineOrder(payload: Record<string, unknown>): OfflineOrder {
  const order: OfflineOrder = {
    id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    queued_at: new Date().toISOString(),
  };
  saveOfflineOrders([...getOfflineOrders(), order]);
  return order;
}

let syncing = false;

export interface SyncResult {
  synced: number;
  dropped: number;
  remaining: number;
}

/**
 * Kirim ulang semua transaksi offline satu per satu (urut FIFO).
 * - Sukses → dihapus dari antrian.
 * - Error jaringan → berhenti, coba lagi nanti (masih offline).
 * - Error validasi (4xx) → di-drop agar tidak menyumbat antrian, dicatat di console.
 */
export async function syncOfflineOrders(): Promise<SyncResult> {
  if (syncing) return { synced: 0, dropped: 0, remaining: getOfflineOrderCount() };
  syncing = true;

  let synced = 0;
  let dropped = 0;

  try {
    let queue = getOfflineOrders();

    while (queue.length > 0) {
      const current = queue[0];
      try {
        await api.post('/orders', { ...current.payload, offline_queued_at: current.queued_at });
        synced += 1;
        queue = queue.slice(1);
        saveOfflineOrders(queue);
      } catch (error) {
        if (isNetworkError(error)) {
          break; // masih offline, coba lagi nanti
        }
        console.error('Transaksi offline ditolak server, di-drop:', current, error);
        dropped += 1;
        queue = queue.slice(1);
        saveOfflineOrders(queue);
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, dropped, remaining: getOfflineOrderCount() };
}
