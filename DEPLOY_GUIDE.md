# Panduan Deployment Aplikasi Kasir POS dengan Nginx (Windows)

Dokumen ini menjelaskan cara menjalankan aplikasi Kasir POS di komputer Windows lain menggunakan Nginx.

## Prasyarat di Komputer Target
Pastikan komputer target sudah terinstall:
1.  **Nginx for Windows**: [Download disini](https://nginx.org/en/download.html).
2.  **PHP**: (Minimal 8.2) dan tambahkan ke Environment Variable PATH.
3.  **Node.js**: (Minimal v18) untuk build frontend.
4.  **MySQL/MariaDB**: Untuk database.

---

## Tahap 1: Persiapan Aplikasi

### 1. Backend (Laravel)
Buka terminal di folder `backend-app`:
```powershell
# Install dependencies
composer install

# Setup Environment
copy .env.example .env
# Edit .env sesuaikan database (DB_DATABASE, DB_USERNAME, dll)

# Generate Key
php artisan key:generate

# Setup Database & Storage
php artisan migrate --seed
php artisan storage:link
php artisan jwt:secret
```

### 2. Frontend (React)
Buka terminal di folder `frontend-app`:
```powershell
# Install dependencies
npm install

# Build untuk production (Akan menghasilkan folder 'dist')
npm run build
```

---

## Tahap 2: Konfigurasi Nginx

1.  Extract Nginx (misal di `C:\nginx`).
2.  Buka file `nginx-pos-app.conf.example` yang ada di root project aplikasi ini.
3.  Copy isinya.
4.  Buka file config Nginx utama di komputer target: `C:\nginx\conf\nginx.conf`.
5.  Paste konfigurasi tadi ke dalam block `http { ... }` (atau include-kan).
6.  **PENTING**: Edit path di konfigurasi tersebut:
    *   `root`: Arahkan ke folder `frontend-app/dist` (Gunakan garis miring `/` bukan backslash `\`).
    *   `alias` (di /storage): Arahkan ke folder `backend-app/public/storage`.

Contoh hasil edit:
```nginx
root "D:/AplikasiKasir/frontend-app/dist";
...
alias "D:/AplikasiKasir/backend-app/public/storage";
```

---

## Tahap 3: Menjalankan Aplikasi

Agar aplikasi berjalan, Anda perlu menjalankan 2 service:

### 1. Jalankan Backend (Laravel)
Aplikasi butuh backend berjalan di port 8000. Anda bisa membuat shortcut atau batch file `.bat` untuk ini:
```batch
cd /d "D:\AplikasiKasir\backend-app"
php artisan serve --port=8000 --host=127.0.0.1
```
*Biarkan window ini terbuka (minimize).*

### 2. Jalankan Nginx
Double click `nginx.exe` atau via cmd:
```powershell
cd C:\nginx
start nginx
```

---

## Tahap 4: Akses Aplikasi

Buka browser dan akses:
`http://localhost`

Aplikasi seharusnya sudah berjalan:
- Frontend dilayani Nginx dari folder `dist`.
- API request diproxy oleh Nginx ke `localhost:8000`.
- Gambar dilayani langsung oleh Nginx dari folder `storage`.

---

## Tips Troubleshooting
Jika ada error "502 Bad Gateway":
- Pastikan `php artisan serve` sudah jalan di port 8000.

Jika Halaman putih/blank:
- Pastikan `npm run build` sukses dan folder `dist` ada isinya.
- Pastikan path `root` di nginx.conf benar.
