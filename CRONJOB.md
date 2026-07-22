# Cronjob & Scheduled Task untuk Kedai POS

Dokumen ini menjelaskan situasi mana di sistem yang sebaiknya dipindah dari
"dikerjakan langsung saat request" menjadi "dijadwalkan berkala"/"diproses di
background", supaya server (VPS) tidak berat dan kasir tidak menunggu proses
yang sebenarnya tidak perlu realtime.

Berlaku untuk backend Laravel 12 di `backend-App/`, dijalankan di VPS (lihat
`DEPLOYMENT.md` untuk detail infrastruktur).

> **Status implementasi**: Langkah 0 (aktifkan scheduler), Langkah 2
> (WhatsApp → Queue Job), dan Langkah 3 (pruning audit log) **sudah
> diimplementasikan** di kode dan sudah di-push ke `origin/master`. Langkah 4
> (pre-agregasi laporan) dan Langkah 5 (backup DB) masih rencana — belum
> dikerjakan.

---

## 🚀 Deploy perubahan ini ke VPS

Bagian ini khusus untuk menerapkan perubahan cronjob + queue job WhatsApp
(commit `feat: cronjob scheduler + queue job WhatsApp...`) ke VPS yang sudah
berjalan. Ikuti berurutan — beda dengan update biasa di `DEPLOYMENT.md`,
update ini butuh **migration baru** dan **mengaktifkan crontab + queue
worker** untuk pertama kalinya.

### 1. Tarik kode terbaru & migrate

```bash
cd /var/www/kedai-pos          # sesuaikan path repo di VPS Anda
git pull origin master

cd backend-App
composer install --no-dev --optimize-autoloader
php artisan migrate --force     # menambah kolom wa_points_status, wa_info_status, dll
php artisan config:cache
php artisan route:cache
```

Tidak ada perubahan di frontend pada update ini kecuali file TypeScript murni
(tidak ada perubahan `.env`), tapi karena `POSPage.tsx`/`MembersPage.tsx`
berubah, **frontend tetap wajib di-build ulang**:

```bash
cd ../frontend-app
npm ci
npm run build
```

### 2. Pasang crontab Laravel Scheduler (baru pertama kali di server ini)

Scheduler baru diaktifkan di kode — cron OS-nya perlu dipasang manual **sekali
saja**, ini tidak otomatis ikut ter-pull dari Git:

```bash
crontab -e
```

Tambahkan baris berikut di akhir file (ganti path sesuai lokasi repo Anda):

```
* * * * * cd /var/www/kedai-pos/backend-App && php artisan schedule:run >> /var/log/kedai-pos-schedule.log 2>&1
```

Simpan, lalu verifikasi crontab tersimpan:

```bash
crontab -l
```

Pastikan file log bisa ditulis (biar tidak silent fail):

```bash
sudo touch /var/log/kedai-pos-schedule.log
sudo chown $USER:$USER /var/log/kedai-pos-schedule.log
```

### 3. Pastikan Queue Worker benar-benar jalan (WhatsApp sekarang lewat queue)

Sebelum update ini, worker Supervisor (`kedai-pos-worker`) di server memang
sudah disebut di `DEPLOYMENT.md`, tapi **tidak pernah memproses job apapun**
karena tidak ada job yang di-dispatch. Sekarang notifikasi WhatsApp
(`SendOrderPointsWhatsAppJob`, `SendMemberPointsInfoJob`) dikirim lewat queue
— **worker wajib jalan**, kalau tidak, notifikasi WA member tidak akan pernah
terkirim (status macet di `queued` selamanya).

Cek dulu apakah konfigurasi Supervisor untuk worker sudah ada:

```bash
sudo supervisorctl status
```

**Jika `kedai-pos-worker` sudah muncul di daftar** — cukup restart:
```bash
sudo supervisorctl restart kedai-pos-worker:*
```

**Jika belum ada sama sekali** (worker belum pernah benar-benar disetup),
buat konfigurasinya:

```bash
sudo nano /etc/supervisor/conf.d/kedai-pos-worker.conf
```

Isi dengan (sesuaikan path & user):

```ini
[program:kedai-pos-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/kedai-pos/backend-App/artisan queue:work --sleep=3 --tries=2 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/www/kedai-pos/backend-App/storage/logs/worker.log
stopwaitsecs=3600
```

Lalu aktifkan:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start kedai-pos-worker:*
```

### 4. Verifikasi semua jalan dengan benar

```bash
# Jadwal terdaftar dengan benar
cd /var/www/kedai-pos/backend-App
php artisan schedule:list

# Tunggu 1-2 menit, lalu cek log cron mulai terisi
tail -f /var/log/kedai-pos-schedule.log

# Worker queue statusnya RUNNING
sudo supervisorctl status kedai-pos-worker:*

# Tidak ada job WA yang menumpuk gagal
php artisan queue:failed
```

**Tes fungsional di aplikasi:**
1. Buka Kasir → checkout transaksi dengan member yang dapat/tukar poin →
   pembayaran **langsung selesai tanpa jeda** (sebelumnya menunggu API WA).
2. Beberapa detik kemudian, toast "Info poin & reward terkirim ke WhatsApp
   member" (atau toast gagal) muncul otomatis — ini hasil polling ke
   `GET /orders/{order}/wa-points-status`.
3. Halaman Member → klik "Kirim Info Poin" → toast "sedang dikirim" muncul
   dulu, lalu toast hasil akhir menyusul dari `GET /members/{member}/wa-info-status`.
4. Kalau toast hasil akhir tidak pernah muncul (macet di "sedang dikirim"),
   berarti worker belum jalan — cek ulang Langkah 3.

---

## Kenapa perlu cronjob di sistem ini

Dari hasil audit kode, ditemukan beberapa hal yang saat ini terjadi **di dalam
request** padahal seharusnya bisa dijadwalkan/dipisah:

| Proses | Terjadi di mana sekarang | Masalahnya |
|---|---|---|
| Kirim notifikasi WhatsApp (member baru, info poin) | Sinkron, di dalam `OrderController@store`/`updateItems` dan `MemberController@store`/`sendPointsInfo` | Kasir menunggu HTTP call ke Meta Graph API selesai sebelum transaksi/print struk beres |
| Housekeeping session lama | "Lottery" 2% di tiap request (bawaan Laravel, `config/session.php`) | Beban tak terduga dibebankan acak ke user yang sedang login/checkout |
| Audit log | Ditulis terus, tidak pernah dihapus (`AuditLogger`) | Tabel `audit_logs` tumbuh tanpa batas, query listing makin lambat |
| Laporan penjualan, RFM member, rekap bulanan | Dihitung ulang dari tabel mentah setiap kali halaman dibuka | Untuk data yang sudah "final" (kemarin, bulan lalu), dihitung ulang terus-menerus itu kerja sia-sia |
| Export Excel (rekap belanja, cuti) | `Excel::download()` sinkron dalam request | Untuk data besar, proses generate file bisa memblokir worker PHP cukup lama |
| Backup database | **Tidak ada sama sekali** | Kalau VPS bermasalah, tidak ada titik pemulihan |

Infrastruktur queue-nya sebenarnya **sudah disiapkan** tapi belum dipakai:
`.env.example` sudah set `QUEUE_CONNECTION=database`, tabel `jobs` sudah ada
dari migration bawaan Laravel, dan `DEPLOYMENT.md` bahkan sudah menyebut proses
`kedai-pos-worker` di Supervisor — tapi sampai sekarang **tidak ada satu pun
Job class** yang dibuat, dan **Laravel Scheduler belum diaktifkan** di
`bootstrap/app.php`.

---

## Konsep: Scheduler vs Queue (dua hal beda, sering ketuker)

- **Laravel Scheduler** (`schedule:run`) → cronjob asli, jalan di waktu
  tertentu (misal tiap malam jam 2). Cocok untuk: laporan harian, pruning log,
  backup DB.
- **Laravel Queue** (`queue:work`, worker Supervisor yang sudah disebut di
  `DEPLOYMENT.md`) → bukan "terjadwal", tapi "ditunda dari request saat ini
  agar tidak memblokir user". Cocok untuk: kirim WhatsApp, generate Excel besar.

Keduanya perlu di-setup, dan keduanya sebenarnya cuma butuh **satu baris cron**
di level OS:

```bash
* * * * * cd /var/www/kedai-pos/backend-App && php artisan schedule:run >> /dev/null 2>&1
```

Baris cron di atas jalan tiap menit, tapi Laravel sendiri yang menentukan
task mana yang benar-benar due dieksekusi berdasarkan jadwal yang kita
definisikan di kode. Jadi **cukup pasang cron ini satu kali**, semua jadwal
lain (harian, mingguan, per-jam) diatur di kode PHP, bukan di banyak baris
crontab.

---

## Rencana Implementasi

### Langkah 0 — Aktifkan Scheduler Laravel ✅ Sudah diimplementasikan

Laravel 12 mendaftarkan jadwal lewat `bootstrap/app.php` (bukan
`app/Console/Kernel.php` seperti versi lama). Sudah ditambahkan
`->withSchedule()` di [bootstrap/app.php](backend-App/bootstrap/app.php):

```php
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(/* ... */)
    ->withMiddleware(/* ... */)
    ->withSchedule(function (Schedule $schedule): void {
        // Bersihkan sesi lama tiap malam (menggantikan "lottery" acak bawaan Laravel di tiap request)
        $schedule->command('session:gc')->daily();

        // Hapus audit log lebih lama dari 90 hari, supaya tabel tidak tumbuh tanpa batas
        $schedule->command('audit-logs:prune', ['--days=90'])->dailyAt('01:00');
    })
    ->withExceptions(/* ... */)
    ->create();
```

Verifikasi kapan saja dengan:
```bash
php artisan schedule:list
```

### Langkah 1 — Pasang cron di VPS (sekali saja)

Lihat tutorial lengkapnya di bagian [🚀 Deploy perubahan ini ke VPS](#-deploy-perubahan-ini-ke-vps)
di atas — mencakup pasang crontab, migration, dan mengaktifkan queue worker
sekaligus.

### Langkah 2 — Pindahkan notifikasi WhatsApp ke Queue ✅ Sudah diimplementasikan

Ini bukan cron, tapi paling berdampak ke pengalaman kasir — sudah dikerjakan
bareng karena keduanya sama-sama soal "jangan blokir request utama".

Dua job baru dibuat:
- [app/Jobs/SendOrderPointsWhatsAppJob.php](backend-App/app/Jobs/SendOrderPointsWhatsAppJob.php)
  — dipakai di `OrderController@store` dan `@update` (settle), menggantikan
  panggilan sinkron `MemberPointsMessage::sendTransactionPoints()`.
- [app/Jobs/SendMemberPointsInfoJob.php](backend-App/app/Jobs/SendMemberPointsInfoJob.php)
  — dipakai di `MemberController@sendPointsInfo`, menggantikan panggilan
  sinkron `WhatsAppNotifier::sendTemplate()`/`sendText()`.

Kolom status baru ditambahkan lewat migration
`2026_07_22_190101_add_wa_notification_status_to_orders_and_members_table`:
- `orders.wa_points_status` (`queued`/`sent`/`failed`) + `wa_points_sent_at`
- `members.wa_info_status`, `wa_info_method` (`template`/`text`), `wa_info_sent_at`

Controller sekarang set status `queued` lalu dispatch job — **tidak lagi
menunggu** response Meta Graph API sebelum mengembalikan response ke frontend:

```php
$order->update(['wa_points_status' => 'queued']);
SendOrderPointsWhatsAppJob::dispatch($order->id);
```

**Toast di frontend diganti mekanisme polling** (bukan lagi hasil sinkron
dalam response checkout):
- [frontend-app/src/lib/pollWaStatus.ts](frontend-app/src/lib/pollWaStatus.ts)
  — helper generik: poll tiap 2 detik sampai status bukan `queued` lagi
  (maksimal 15x percobaan), lalu jalankan callback.
- Endpoint polling: `GET /orders/{order}/wa-points-status` dan
  `GET /members/{member}/wa-info-status`.
- Dipakai di `POSPage.tsx` (fungsi `pollOrderWaPointsStatus`) dan
  `MembersPage.tsx` (`handleSendPointsInfo`) — toast sukses/gagal muncul
  begitu job selesai diproses worker, bukan lagi di dalam response awal.

Worker sudah disiapkan di server (`supervisorctl restart kedai-pos-worker:*`
di `DEPLOYMENT.md`) — pastikan konfigurasi Supervisor benar-benar menjalankan
`php artisan queue:work --tries=2`, karena sebelumnya restart itu tidak
mengerjakan apa-apa (belum ada job yang di-dispatch). Untuk tes lokal, jalankan
worker manual:

```bash
php artisan queue:work --tries=2
```

### Langkah 3 — Command pruning Audit Log ✅ Sudah diimplementasikan

Command [app/Console/Commands/PruneAuditLogs.php](backend-App/app/Console/Commands/PruneAuditLogs.php)
(`audit-logs:prune {--days=90}`) sudah dibuat dan dijadwalkan harian jam 01:00
(lihat Langkah 0). Retensi 90 hari hanya default — sesuaikan kebutuhan
compliance/audit toko lewat `--days=`.

Jalankan manual kapan saja:
```bash
php artisan audit-logs:prune --days=90
```

### Langkah 4 — Pre-agregasi laporan penjualan (opsional, kalau data mulai besar)

Kalau `salesReport()`/`rfm()`/`monthlyRecap()` di `OrderController.php` dan
`MemberController.php` mulai terasa lambat (biasanya setelah beberapa bulan
data menumpuk), buat command yang menghitung ringkasan tiap malam ke tabel
baru (`daily_sales_summary`), dan ubah endpoint laporan untuk baca dari tabel
ringkasan itu, bukan hitung ulang dari tabel `orders` mentah. Ini best-effort
optimization — tidak wajib di awal, tapi siapkan begitu laporan mulai lambat
dibuka.

### Langkah 5 — Backup database otomatis

Paling sederhana pakai `spatie/laravel-backup`:

```bash
composer require spatie/laravel-backup
php artisan vendor:publish --provider="Spatie\Backup\BackupServiceProvider"
```

Jadwalkan di `bootstrap/app.php`:

```php
$schedule->command('backup:clean')->daily()->at('01:00');
$schedule->command('backup:run')->daily()->at('01:30');
```

Konfigurasi tujuan backup (`config/backup.php`) — simpan ke disk terpisah dari
VPS (S3-compatible storage, atau minimal folder di luar `public_html`) supaya
kalau VPS rusak total, backup tidak ikut hilang.

---

## Ringkasan Prioritas

1. ✅ **WhatsApp → Queue Job** — dampak langsung: kasir tidak lagi menunggu API pihak ketiga saat checkout.
2. ✅ **`session:gc` via cron** — menghilangkan beban acak "lottery" dari request user biasa.
3. ✅ **Pruning audit log** — mencegah tabel tumbuh tanpa batas.
4. ⬜ **Backup database terjadwal** — belum ada sama sekali, risiko kehilangan data kalau VPS bermasalah.
5. ⬜ **Pre-agregasi laporan** — lakukan begitu laporan mulai terasa lambat dibuka (bukan prioritas hari pertama).
6. ⬜ **Export Excel besar → queued export** (`Excel::queue()` bukan `Excel::download()`) — begitu file rekap mulai besar.

## Verifikasi setelah setup

```bash
# Pastikan jadwal terdaftar
php artisan schedule:list

# Jalankan manual untuk tes tanpa nunggu jadwal asli
php artisan session:gc
php artisan audit-logs:prune --days=90
php artisan backup:run

# Cek command sedang due dieksekusi cron (jalan di server, tunggu 1 menit)
tail -f /var/log/kedai-pos-schedule.log

# Cek worker queue jalan (untuk notifikasi WA)
sudo supervisorctl status kedai-pos-worker:*
php artisan queue:failed   # pastikan tidak ada job WA yang gagal terus
```
