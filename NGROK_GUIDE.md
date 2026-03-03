# Panduan Akses Online dengan Ngrok

Panduan ini akan membantu Anda men-online-kan aplikasi Kasir POS agar bisa diakses dari HP, Tablet, atau komputer di luar lokasi menggunakan **Ngrok**.

## Metode Terbaik: Nginx + Ngrok (Satu Pintu)

Sangat disarankan memakai metode ini agar tidak ada masalah koneksi antara Frontend dan Backend.

### Langkah 1: Pastikan Aplikasi Berjalan Lokal (via Nginx)
Ikuti panduan `DEPLOY_GUIDE.md` sebelumnya sampai aplikasi bisa dibuka di browser lokal dengan alamat:
`http://localhost`

Pastikan:
1.  `php artisan serve` jalan (port 8000).
2.  `nginx` jalan.
3.  Frontend sudah di-build (`npm run build`).
4.  Buka `http://localhost` di browser: Aplikasi muncul dan bisa login.

### Langkah 2: Download & Setup Ngrok
1.  Download Ngrok dari [ngrok.com](https://ngrok.com/download).
2.  Extract file `ngrok.exe`.
3.  Buka terminal/CMD di folder ngrok tersebut.
4.  Login akun ngrok (jika belum):
    ```powershell
    ngrok config add-authtoken TOKEN_ANDA
    ```

### Langkah 3: Jalankan Tunnel
Jalankan perintah ini untuk meng-online-kan Port 80 (Nginx Anda):

```powershell
ngrok http 80
```

### Langkah 4: Akses Aplikasi
Ngrok akan memberikan URL publik, contohnya:
`https://a1b2-c3d4.ngrok-free.app`

1.  Copy URL tersebut.
2.  Buka di HP atau Komputer lain.
3.  **Login Aplikasi**: Aplikasi seharusnya berjalan normal!

---

## Troubleshooting Penting (Jika Backend Error)

Jika frontend muncul tapi **gagal login** atau **gagal ambil data**, itu karena Laravel memblokir host asing (Trusted Proxy) atau masalah HTTP vs HTTPS.

### 1. Izinkan Host Ngrok di Laravel
Buka file `backend-app/app/Http/Middleware/TrustProxies.php` (atau `bootstrap/app.php` di Laravel 11).

Untuk Laravel 11, buka `backend-app/bootstrap/app.php`, tambahkan konfigurasi trust proxies:

```php
// Di dalam ->withMiddleware(function (Middleware $middleware) { ...
$middleware->trustProxies(at: '*');
```

### 2. Force HTTPS di Laravel (Opsional)
Jika frontend diakses via HTTPS (ngrok) tapi backend merespon HTTP, browser akan memblokir (Mixed Content).
Buka `backend-app/app/Providers/AppServiceProvider.php`, di method `boot()`:

```php
use Illuminate\Support\Facades\URL;

public function boot()
{
    if($this->app->environment('production') || str_contains(request()->url(), 'ngrok-free.app')) {
        URL::forceScheme('https');
    }
}
```

### 3. Setting .env Backend
Ubah `APP_URL` di file `.env` komputer lokal menjadi URL ngrok agar link gambar benar:
```env
APP_URL=https://url-ngrok-anda.ngrok-free.app
```
*(Jangan lupa kembalikan ke localhost jika sudah selesai demo)*
