import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { getOfflineOrderCount, syncOfflineOrders } from '@/lib/offlineOrders';

/**
 * Status koneksi + antrian transaksi offline.
 * Auto-sync saat browser kembali online.
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getOfflineOrderCount());

  const refreshCount = useCallback(() => setPendingCount(getOfflineOrderCount()), []);

  const syncNow = useCallback(async () => {
    const result = await syncOfflineOrders();
    refreshCount();
    if (result.synced > 0) {
      toast.success(`${result.synced} transaksi offline berhasil disinkronkan`);
    }
    if (result.dropped > 0) {
      toast.error(`${result.dropped} transaksi offline ditolak server (cek console)`);
    }
    return result;
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (getOfflineOrderCount() > 0) {
        toast.info('Koneksi kembali — menyinkronkan transaksi offline...');
        void syncNow();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-orders-changed', refreshCount);

    // Sinkronkan sisa antrian saat halaman dibuka dalam keadaan online
    if (navigator.onLine && getOfflineOrderCount() > 0) {
      void syncNow();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-orders-changed', refreshCount);
    };
  }, [syncNow, refreshCount]);

  return { isOnline, pendingCount, syncNow };
}
