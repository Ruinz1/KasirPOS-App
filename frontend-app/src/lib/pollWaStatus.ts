/**
 * Poll endpoint status pengiriman WhatsApp (async job) sampai statusnya
 * bukan lagi "queued", lalu jalankan callback dengan status akhirnya.
 * Berhenti otomatis setelah maxAttempts supaya tidak polling selamanya
 * jika job gagal terjadwal / worker mati.
 */
export async function pollWaStatus<T extends { status: string | null }>(
  fetchStatus: () => Promise<T>,
  onDone: (result: T) => void,
  { intervalMs = 2000, maxAttempts = 15 }: { intervalMs?: number; maxAttempts?: number } = {}
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    try {
      const result = await fetchStatus();
      if (result.status && result.status !== 'queued') {
        onDone(result);
        return;
      }
    } catch {
      return;
    }
  }
}
