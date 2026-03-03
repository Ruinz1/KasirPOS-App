# Sistem Antrian FIFO - KasirPOS App

## Deskripsi
Sistem antrian FIFO (First In First Out) untuk mengelola pesanan yang sudah selesai dari kasir. Sistem ini menampilkan **hanya pesanan hari ini** agar sinkron dengan kasir dan memungkinkan dapur/produksi untuk melihat antrian pesanan secara berurutan berdasarkan waktu pemesanan.

## Fitur Utama

### 1. **Antrian Otomatis - Hari Ini**
- Setiap pesanan yang selesai dari kasir otomatis masuk ke antrian dengan status "pending"
- **Hanya menampilkan pesanan hari ini** untuk menjaga relevansi dan sinkronisasi dengan kasir
- Urutan antrian berdasarkan waktu pembuatan (FIFO - First In First Out)
- Nomor antrian otomatis (#001, #002, dst)
- Antrian otomatis reset setiap hari

### 2. **Informasi Lengkap**
Setiap item antrian menampilkan:
- Nomor antrian
- Nama pelanggan
- Waktu pemesanan
- Nama kasir yang melayani
- Detail pesanan lengkap (item, quantity, harga)
- Total pembayaran
- Catatan khusus

### 3. **Manajemen Status**
- **Pending**: Pesanan baru menunggu diproses
- **In Progress**: Pesanan sedang dikerjakan
- **Completed**: Pesanan selesai dikerjakan

### 4. **Checklist Selesai**
- Checkbox untuk menandai pesanan selesai
- Otomatis mencatat waktu penyelesaian
- Pesanan selesai tidak muncul di antrian aktif

### 5. **Catatan Pesanan**
- Tambah/edit catatan untuk setiap pesanan
- Catatan bisa berisi instruksi khusus, modifikasi, atau informasi penting lainnya
- Klik pada area catatan untuk mengedit

### 6. **Statistik Real-time**
Dashboard menampilkan:
- Total antrian aktif
- Jumlah pesanan menunggu
- Jumlah pesanan sedang diproses
- Jumlah pesanan selesai hari ini

### 7. **Live Update Real-time**
- Otomatis refresh setiap **5 detik** untuk pengalaman live
- Badge "LIVE" dengan animasi pulse menunjukkan sistem aktif
- Timestamp terakhir update ditampilkan di header
- Tombol manual refresh tersedia jika diperlukan
- Data selalu up-to-date tanpa perlu refresh manual

## Alur Kerja

### Dari Kasir:
1. Kasir membuat pesanan di halaman POS
2. Setelah pembayaran selesai, pesanan otomatis masuk antrian dengan status "pending"
3. Pesanan muncul di halaman Antrian

### Di Halaman Antrian:
1. Staff dapur/produksi membuka halaman Antrian
2. Melihat daftar pesanan berurutan (FIFO)
3. Memproses pesanan dari atas ke bawah
4. Menambahkan catatan jika diperlukan
5. Centang checkbox "Selesai" setelah pesanan selesai dibuat
6. Pesanan selesai hilang dari antrian aktif

### Update Pesanan:
- Jika ada update/perubahan pada pesanan yang sudah selesai, pesanan **TIDAK** masuk ke antrian lagi
- Update hanya mengubah data pesanan tanpa mengubah status antrian

## Struktur Database

### Kolom Baru di Tabel `orders`:
```sql
queue_status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending'
notes TEXT NULL
queue_completed_at TIMESTAMP NULL
```

## API Endpoints

### 1. Get Queue List (Today Only)
```
GET /api/queue
```
Response: Array of orders dengan status completed, queue_status pending/in_progress, dan **created_at hari ini**

### 2. Get Queue Statistics (Today Only)
```
GET /api/queue/statistics
```
Response: 
```json
{
  "pending": 5,           // Pesanan pending hari ini
  "in_progress": 2,       // Pesanan in progress hari ini
  "completed_today": 15,  // Pesanan completed hari ini
  "total_in_queue": 7     // Total antrian aktif hari ini
}
```

### 3. Update Queue Status
```
PUT /api/queue/{id}/status
Body: { "queue_status": "completed" }
```

### 4. Update Notes
```
PUT /api/queue/{id}/notes
Body: { "notes": "Catatan pesanan..." }
```

## Akses & Permission

- **Permission**: `manage_orders`
- **Role yang bisa akses**:
  - Admin (semua toko)
  - Owner (toko sendiri)
  - Kasir (toko sendiri)

## Cara Penggunaan

### 1. Akses Halaman Antrian
- Klik menu "Antrian" di sidebar
- Atau akses langsung ke `/queue`

### 2. Melihat Antrian
- Antrian ditampilkan berurutan dari atas ke bawah
- Nomor antrian menunjukkan urutan
- Warna badge menunjukkan status:
  - Abu-abu: Menunggu
  - Biru: Sedang Diproses
  - Hijau: Selesai

### 3. Menambah Catatan
- Klik pada area "Catatan" di bawah detail pesanan
- Ketik catatan yang diperlukan
- Klik "Simpan" untuk menyimpan
- Klik "Batal" untuk membatalkan

### 4. Menyelesaikan Pesanan
- Centang checkbox "Selesai" di kanan atas card pesanan
- Pesanan akan otomatis hilang dari antrian aktif
- Waktu penyelesaian tercatat otomatis

### 5. Refresh Data
- Klik tombol "Refresh" di kanan atas
- Atau tunggu auto-refresh setiap 30 detik

## Tips Penggunaan

1. **Prioritas FIFO**: Selalu kerjakan pesanan dari atas ke bawah untuk menjaga keadilan waktu tunggu
2. **Gunakan Catatan**: Manfaatkan fitur catatan untuk instruksi khusus atau reminder
3. **Monitor Statistik**: Perhatikan jumlah antrian untuk mengatur kecepatan produksi
4. **Multi-device**: Halaman antrian bisa dibuka di beberapa device sekaligus (tablet di dapur, dll)

## Troubleshooting

### Antrian tidak muncul
- Pastikan pesanan sudah selesai dari kasir (status: completed)
- Refresh halaman atau klik tombol Refresh
- Periksa koneksi internet

### Tidak bisa update status
- Pastikan memiliki permission `manage_orders`
- Pastikan pesanan milik toko yang sama
- Periksa koneksi ke backend

### Catatan tidak tersimpan
- Pastikan klik tombol "Simpan"
- Jangan refresh halaman sebelum catatan tersimpan
- Periksa koneksi internet

## File yang Dimodifikasi/Dibuat

### Backend:
1. `database/migrations/2026_02_04_000000_add_queue_fields_to_orders_table.php` - Migration
2. `app/Models/Order.php` - Update model
3. `app/Http/Controllers/QueueController.php` - Controller baru
4. `routes/api.php` - Routes baru

### Frontend:
1. `src/pages/QueuePage.tsx` - Halaman antrian baru
2. `src/App.tsx` - Route baru
3. `src/components/layout/Sidebar.tsx` - Menu navigasi

## Pengembangan Selanjutnya

Fitur yang bisa ditambahkan:
1. Notifikasi suara saat ada pesanan baru
2. Print ticket antrian
3. Estimasi waktu penyelesaian
4. Filter berdasarkan status
5. Laporan performa antrian (rata-rata waktu tunggu, dll)
6. Integrasi dengan display monitor untuk pelanggan
