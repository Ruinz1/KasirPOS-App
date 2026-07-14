# Update Fitur Baru ke VPS

VPS sudah berjalan. Dokumen ini hanya alur **menerapkan perubahan terbaru**
(UI mobile responsif + perbaikan URL gambar produksi) ke server yang sudah ada.

## Yang berubah di update ini

- **Navigasi mobile**: sidebar jadi drawer (hamburger) di HP, konten dapat lebar penuh.
- **Halaman Kasir (POS) mobile**: layout rapi; keranjang bisa dibuka/tutup, mode full-screen saat dibuka.
- **Laporan**: tampil benar di layar kecil (tidak lagi ketutup sidebar).
- **Perbaikan penting produksi**: URL gambar kini dibangun via helper `storageUrl()`
  yang mengambil dari `https://<domain-api>/storage/...` (bukan `.../api/storage/...`).
  **Karena ini, frontend WAJIB di-build ulang** agar gambar muncul di VPS.
- **Migrasi DB baru** (varian bahan menu & pengurangan stok per item).

## Pengaturan Environment Variables (.env) di VPS

File `.env` berisi data sensitif seperti kredensial database dan API keys, sehingga **tidak dimasukkan ke Git**. Berikut cara konfigurasi `.env` di VPS:

### 1. Backend (Laravel) - `backend-App/.env`
Di folder project VPS, buat file `.env` baru dari template `.env.example`:
```bash
cd backend-App
cp .env.example .env
nano .env
```
Sesuaikan konfigurasi berikut:
*   `APP_ENV=production` dan `APP_DEBUG=false`
*   `APP_URL=https://api.kedaiposapp.online` (URL domain backend API Anda)
*   Koneksi Database (`DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` sesuai database VPS)
*   Integrasi WhatsApp (`WHATSAPP_PROVIDER` diisi `meta` atau `gateway` beserta kredensial masing-masing)

Setelah file `.env` disimpan, buat application key & jalankan migrasi di VPS:
```bash
php artisan key:generate
php artisan jwt:secret
php artisan migrate --force
```

### 2. Frontend (React / Vite) - `frontend-app/.env.production`
Variabel env di frontend (Vite) akan ditanam langsung (hardcoded) ke dalam kode JS saat proses build.
```bash
cd ../frontend-app
nano .env.production
```
Isi dengan:
```env
VITE_API_URL=https://api.kedaiposapp.online/api
```
*(PENTING: Akhiri dengan `/api`. Setiap kali file ini diubah, Anda wajib menjalankan `npm run build` ulang agar perubahannya diterapkan).*

---

## Alur deploy (jalankan di VPS)

```bash
cd /var/www/kedai-pos          # sesuaikan path repo di VPS Anda
git pull origin master

# --- Backend: jalankan migrasi baru + refresh cache ---
cd backend-App
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan storage:link        # aman dijalankan ulang; skip bila symlink sudah ada
php artisan config:cache
php artisan route:cache
php artisan view:cache
# restart worker bila pakai Supervisor:
sudo supervisorctl restart kedai-pos-worker:* 2>/dev/null || true

# --- Frontend: WAJIB build ulang (fix URL gambar + UI mobile) ---
cd ../frontend-app
npm ci
npm run build                   # hasil ke dist/, langsung dilayani Nginx

sudo systemctl reload nginx
```

## Verifikasi setelah deploy

1. Buka situs di **HP** → muncul tombol hamburger, menu bisa dibuka; halaman
   Kasir & Laporan tampil rapi tanpa terpotong.
2. Cek **gambar** (logo toko / bukti bayar) muncul. Kalau masih 404:
   - Pastikan `frontend-app/.env.production` → `VITE_API_URL=https://<domain-api>/api`
     lalu **build ulang** (nilai env di-inline saat build).
   - Pastikan `php artisan storage:link` sudah ada dan
     `https://<domain-api>/storage/<file>` bisa dibuka langsung.

> Catatan: `VITE_API_URL` harus **berakhiran `/api`**. Helper `storageUrl()`
> otomatis membuang `/api` saat menyusun URL file storage.
