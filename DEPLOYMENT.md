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

### 1a. Integrasi WhatsApp (Meta Cloud API) - `backend-App/.env`

Fitur notifikasi WA (member baru, info poin setelah bayar, tombol tes di halaman Member) memakai **Meta WhatsApp Cloud API** langsung. Tambahkan 4 baris ini ke `backend-App/.env` di VPS:

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_META_ACCESS_TOKEN=EAAxxxx...           # token system user (lihat cara ambil di bawah)
WHATSAPP_META_PHONE_NUMBER_ID=1164406100097805  # ID nomor telepon di WhatsApp Manager
WHATSAPP_META_WABA_ID=1011403468253430          # ID akun WhatsApp Business (WABA)
```

**Dari mana nilai-nilai ini didapat:**

| Variabel | Sumber |
|---|---|
| `WHATSAPP_META_ACCESS_TOKEN` | [business.facebook.com/settings](https://business.facebook.com/settings) → **Pengguna sistem** → pilih system user → **Buat token** → pilih aplikasi (KedaiPos) → masa berlaku **Tidak pernah kedaluwarsa** → centang izin `whatsapp_business_messaging` + `whatsapp_business_management` |
| `WHATSAPP_META_PHONE_NUMBER_ID` | WhatsApp Manager → **Nomor telepon** → klik nomornya → "ID nomor telepon" |
| `WHATSAPP_META_WABA_ID` | WhatsApp Manager → lihat parameter `asset_id` di URL, atau Pengaturan Bisnis → **Akun WhatsApp** → kolom ID |
| `WHATSAPP_PROVIDER` | `meta` (langsung ke Graph API). Isi `gateway` hanya jika kembali pakai chat.api.co.id |

Setelah mengubah `.env`, selalu jalankan:
```bash
php artisan config:clear
```

**Verifikasi koneksi & status template:**
```bash
php artisan whatsapp:test --status 0
```
Perintah ini menampilkan nomor yang terhubung beserta daftar template dan statusnya. Template harus berstatus `APPROVED` agar pesan bisa dikirim tanpa syarat. Template yang dipakai aplikasi: `member_baru` (member baru), `poin_transaksi` (poin setelah bayar), `info_poin` (tombol tes di halaman Member).

**Tes kirim manual:**
```bash
# Kirim template (parameter bernama pakai format kunci=nilai)
php artisan whatsapp:test 08xxxxxxxxxx member_baru customer_name=Budi bakso_bento_malang="Nama Toko"

# Kirim teks bebas (hanya berhasil jika nomor tujuan chat duluan ke nomor bisnis <24 jam)
php artisan whatsapp:test 08xxxxxxxxxx --text="Tes koneksi"
```

**Catatan penting:**
* Token dengan masa berlaku 60 hari akan mati diam-diam — selalu buat token **Tidak pernah kedaluwarsa**. Cek masa berlaku token di [developers.facebook.com/tools/debug/accesstoken](https://developers.facebook.com/tools/debug/accesstoken).
* Jika pengiriman gagal, detail error dari Meta tercatat di `storage/logs/laravel.log`.
* Template, nomor, dan WABA tersimpan di akun Meta (bukan di server), jadi nilai env-nya **sama persis** antara lokal dan VPS.

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

## Setup Cloudflare (proxy domain, SSL, & halaman error saat server down)

Tujuan: semua trafik `kedaiposapp.online` dan `api.kedaiposapp.online` lewat
Cloudflare. Saat VPS mati/tidak terjangkau, pengunjung melihat halaman error
Cloudflare (bukan timeout kosong), plus dapat SSL & proteksi DDoS gratis.

### 1. Daftarkan domain

1. Buat akun di [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site**
   → masukkan `kedaiposapp.online` → pilih paket **Free**.
2. Cloudflare menyalin DNS record otomatis. Pastikan dua record ini ada dan
   **Proxy status = Proxied (awan oranye)**:

   | Type | Name  | Content     | Proxy    |
   |------|-------|-------------|----------|
   | A    | `@`   | IP VPS Anda | Proxied  |
   | A    | `api` | IP VPS Anda | Proxied  |

3. Ganti nameserver di registrar domain Anda (tempat beli domain) ke dua
   nameserver yang diberikan Cloudflare. Propagasi biasanya < 1 jam.

### 2. Mode SSL — WAJIB "Full (strict)"

**SSL/TLS → Overview → Full (strict)** (VPS sudah punya sertifikat Let's Encrypt).

> Jangan pakai mode "Flexible" — menyebabkan redirect loop dengan Nginx yang
> sudah redirect HTTP→HTTPS.

Untuk perpanjangan sertifikat origin, dua pilihan:
- **Tetap certbot**: perpanjangan HTTP-01 tetap jalan di belakang proxy selama
  mode Full (strict) dan path `/.well-known/acme-challenge/` tidak diblokir.
- **Lebih awet — Origin Certificate**: **SSL/TLS → Origin Server → Create
  Certificate** (berlaku 15 tahun), pasang di Nginx menggantikan certbot.
  Sertifikat ini hanya dipercaya Cloudflare, jadi proxy oranye tidak boleh
  dimatikan lagi.

### 3. Aturan cache — jangan cache API & service worker

**Caching → Cache Rules**, buat 2 rule:

1. **Bypass API** — If URI Path starts with `/api/` → **Bypass cache**
   (untuk hostname `api.kedaiposapp.online` bisa juga bypass semua path).
2. **Service worker selalu segar** — If URI Path equals `/sw.js` → **Bypass
   cache**. Tanpa ini update aplikasi PWA bisa telat sampai ke kasir.

### 4. Kembalikan IP asli pengunjung (penting untuk Audit Log)

Di belakang proxy, Nginx melihat IP Cloudflare — kolom IP di halaman Audit Log
jadi tidak akurat. Tambahkan di config Nginx (http block atau file
`/etc/nginx/conf.d/cloudflare-realip.conf`):

```nginx
# Daftar lengkap & terbaru: https://www.cloudflare.com/ips/
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;
```

Lalu `sudo nginx -t && sudo systemctl reload nginx`.

### 5. Opsional tapi berguna

- **Always Online** (Caching → Configuration): saat VPS down, Cloudflare
  menyajikan salinan halaman dari cache — pengunjung masih melihat sesuatu.
- **Speed → Optimization → Brotli**: aktifkan (kompresi lebih kecil dari gzip).
- **Firewall**: kalau mau ketat, izinkan port 80/443 VPS hanya dari IP range
  Cloudflare di atas, supaya orang tidak bisa mem-bypass proxy langsung ke IP.

### 6. Verifikasi

1. `curl -I https://kedaiposapp.online` → ada header `server: cloudflare` dan
   `cf-ray: ...` → trafik sudah lewat proxy.
2. Aplikasi login & transaksi normal, gambar storage tetap muncul.
3. Tes halaman error: `sudo systemctl stop nginx` sebentar → buka situs →
   muncul halaman error Cloudflare (bukan timeout) → `sudo systemctl start nginx`.
4. Halaman Audit Log menampilkan IP pengunjung asli, bukan IP `172.x/104.x`
   milik Cloudflare.
