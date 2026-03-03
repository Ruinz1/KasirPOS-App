# Fitur Manajemen Meja - POS App

## Deskripsi Fitur

Sistem manajemen meja untuk restoran/kafe yang terintegrasi dengan sistem POS. Fitur ini memungkinkan:

1. **Manajemen Nomor Meja**: Tambah, edit, hapus meja dengan nomor dan kapasitas
2. **Status Meja Real-time**: Tersedia, Terisi, atau Dipesan
3. **Integrasi dengan Pesanan**: Otomatis assign meja saat checkout untuk dine-in
4. **Validasi Pembayaran**: Harus bayar terlebih dahulu sebelum dapat memilih meja
5. **Tampilan Visual**: Grid kotak-kotak dengan status warna yang jelas
6. **Tracking Pesanan**: Lihat pesanan aktif di setiap meja

## Alur Kerja (Workflow)

### 1. Kasir Input Pesanan
- Kasir memilih menu dan menambahkan ke keranjang
- Pilih tipe pesanan: **Dine In** atau **Take Away**
- **[BARU]** Untuk Dine-In, kasir dapat memilih:
  - **Sistem Meja** (ON): Akan diminta pilih nomor meja setelah bayar
  - **Antrian Biasa** (OFF): Langsung ke antrian tanpa pemilihan meja
- Input nama pelanggan (opsional)

### 2. Pembayaran
- Pilih metode pembayaran (Cash/Card/QRIS)
- Input jumlah uang yang dibayar
- Sistem validasi pembayaran harus lunas

### 3. Pemilihan Nomor Meja (Khusus Dine-In dengan Sistem Meja ON)
- Setelah pembayaran dikonfirmasi, muncul dialog pemilihan meja
- Tampil grid meja yang tersedia (status: available)
- Kasir memilih nomor meja yang sesuai
- Meja otomatis berubah status menjadi "Terisi" (occupied)
- **Opsi**: Kasir bisa klik "Lewati" jika ingin langsung cetak tanpa assign meja

### 3b. Antrian Biasa (Dine-In dengan Sistem Meja OFF atau Takeaway)
- Langsung ke struk dan antrian
- Tidak ada pemilihan meja
- Pesanan masuk ke sistem antrian biasa

### 4. Pesanan Diantar
- Pelayan melihat pesanan di halaman **Antrian** atau **Meja**
- Makanan disiapkan dan diantar ke meja
- Pelayan dapat menandai "Sudah Disajikan" di halaman Meja

### 5. Selesai Makan & Pengembalian Meja
- Setelah pelanggan selesai, pelayan mengambil papan nama meja
- Kasir/Pelayan klik tombol "Kosongkan Meja" di halaman Meja
- Meja kembali ke status "Tersedia" (available)

## Instalasi & Setup

### 1. Jalankan Migrasi Database

```bash
cd backend-app
php artisan migrate
```

Ini akan membuat:
- Tabel `tables` untuk data meja
- Kolom `table_id` di tabel `orders`

### 2. (Opsional) Seed Data Meja Contoh

```bash
php artisan db:seed --class=TableSeeder
```

Ini akan membuat 10 meja contoh (Meja 1-8, VIP-1, VIP-2)

### 3. Restart Server (jika perlu)

```bash
# Backend
php artisan serve

# Frontend
cd ../frontend-app
npm run dev
```

## Cara Penggunaan

### A. Manajemen Meja (Halaman /tables)

1. **Menambah Meja Baru**
   - Klik tombol "Tambah Meja"
   - Input nomor meja (contoh: 1, A1, VIP-1)
   - Input kapasitas kursi
   - Tambahkan catatan (opsional)
   - Klik "Tambah"

2. **Edit Meja**
   - Klik tombol "Edit" pada meja yang tersedia
   - Update informasi
   - Klik "Update"

3. **Hapus Meja**
   - Hanya bisa hapus meja dengan status "Tersedia"
   - Klik tombol "Hapus"
   - Konfirmasi penghapusan

4. **Kosongkan Meja**
   - Untuk meja yang terisi, klik "Kosongkan"
   - Meja akan kembali ke status tersedia

5. **Tandai Sudah Disajikan**
   - Klik icon centang hijau
   - Status antrian pesanan akan berubah menjadi "Selesai"

### B. Menggunakan Meja di POS (Halaman /pos)

1. **Buat Pesanan Dine-In**
   - Tambahkan item ke keranjang
   - Pilih "Dine In" sebagai tipe pesanan
   - **Toggle Sistem Meja** akan muncul:
     - **ON (Hijau)**: Akan diminta pilih meja setelah bayar
     - **OFF (Abu-abu)**: Langsung ke antrian tanpa meja
   - Klik "Bayar"

2. **Proses Pembayaran**
   - Pilih metode pembayaran
   - Input jumlah uang (untuk cash)
   - Konfirmasi pembayaran

3. **Pilih Nomor Meja** (Jika Toggle Sistem Meja ON)
   - Dialog pemilihan meja akan muncul otomatis
   - Pilih nomor meja yang tersedia (kotak hijau)
   - Klik "Konfirmasi Meja"
   - Atau klik "Lewati" jika tidak ingin assign meja

4. **Cetak Struk**
   - Struk akan otomatis tercetak setelah meja dipilih
   - Struk mencantumkan nomor pesanan dan total

### C. Monitoring Meja

**Statistik di Halaman Meja:**
- Jumlah meja tersedia (hijau)
- Jumlah meja terisi (merah)
- Total meja keseluruhan (biru)

**Info Meja Terisi:**
- Nomor pesanan
- Nama pelanggan
- Total tagihan
- Status antrian (Menunggu/Diproses/Selesai)
- Daftar item pesanan

**Auto-refresh:**
- Data meja otomatis refresh setiap 10 detik

### D. Tampilan Meja di Halaman Antrian

**Informasi yang Ditampilkan:**
- Jika pesanan menggunakan sistem meja, akan muncul badge **🪑 Meja [Nomor]**
- Badge muncul di bawah nama pelanggan
- Warna badge: Biru (primary) dengan background transparan
- Untuk pesanan tanpa meja (antrian biasa), badge tidak muncul

**Contoh Tampilan:**
```
#12
[Dine In] [TAMBAHAN +]
John Doe
🪑 Meja 5          ← Badge nomor meja
10:30
```

**Keuntungan:**
- Pelayan tahu harus mengantar ke meja mana
- Koordinasi lebih mudah antara kasir dan pelayan
- Mengurangi kesalahan pengantaran pesanan

## Validasi & Aturan Bisnis

1. ✅ **Pembayaran Wajib**: Harus bayar lunas sebelum dapat memilih meja
2. ✅ **Hanya Dine-In**: Pemilihan meja hanya untuk pesanan Dine-In
3. ✅ **Meja Tersedia**: Hanya meja dengan status "available" yang bisa dipilih
4. ✅ **Satu Pesanan Per Meja**: Satu meja hanya bisa menampung satu pesanan aktif
5. ✅ **Tidak Bisa Hapus Meja Terisi**: Meja yang sedang terisi tidak bisa dihapus
6. ✅ **Nomor Meja Unik**: Tidak boleh ada duplikat nomor meja dalam satu toko

## Struktur Database

### Tabel `tables`
```sql
- id (bigint, primary key)
- table_number (string) - Nomor meja
- status (enum: available, occupied, reserved) - Status meja
- store_id (bigint, foreign key) - ID toko
- current_order_id (bigint, foreign key, nullable) - ID pesanan aktif
- capacity (integer) - Kapasitas kursi
- notes (text, nullable) - Catatan tambahan
- created_at, updated_at (timestamps)
```

### Tabel `orders` (Tambahan Kolom)
```sql
- table_id (bigint, foreign key, nullable) - ID meja yang digunakan
```

## API Endpoints

### Tables Management
- `GET /api/tables` - List semua meja
- `POST /api/tables` - Tambah meja baru
- `GET /api/tables/{id}` - Detail meja
- `PUT /api/tables/{id}` - Update meja
- `DELETE /api/tables/{id}` - Hapus meja
- `POST /api/tables/{id}/assign` - Assign pesanan ke meja
- `POST /api/tables/{id}/release` - Kosongkan meja
- `POST /api/tables/{id}/mark-served` - Tandai sudah disajikan

## Fitur Tambahan

### 1. Multi-Store Support
- Admin dapat mengelola meja untuk berbagai toko
- Setiap toko memiliki set meja sendiri

### 2. Real-time Updates
- Status meja update otomatis setiap 10 detik
- Sinkronisasi antara halaman POS dan Meja

### 3. Responsive Design
- Grid meja menyesuaikan dengan ukuran layar
- Mobile-friendly untuk tablet kasir

### 4. Visual Indicators
- **Hijau**: Meja tersedia
- **Merah**: Meja terisi
- **Kuning**: Meja dipesan (reserved) - untuk fitur future

## Troubleshooting

### Meja tidak muncul di dialog pemilihan
- Pastikan ada meja dengan status "available"
- Cek apakah toko sudah dipilih (untuk admin)
- Refresh halaman atau tunggu auto-refresh

### Tidak bisa assign meja
- Pastikan pesanan sudah dibayar lunas
- Pastikan tipe pesanan adalah "Dine In"
- Cek apakah meja masih tersedia

### Meja tidak bisa dikosongkan
- Pastikan pesanan sudah selesai
- Cek apakah ada pesanan aktif di meja tersebut

## Saran Pengembangan Selanjutnya

1. **Reservasi Meja**: Fitur booking meja untuk waktu tertentu
2. **Gabung Meja**: Menggabungkan beberapa meja untuk grup besar
3. **Layout Visual**: Drag-and-drop layout meja sesuai denah restoran
4. **QR Code**: QR code di setiap meja untuk self-ordering
5. **Notifikasi**: Push notification saat pesanan siap diantar
6. **Timer**: Tracking waktu pelanggan di meja
7. **Split Bill**: Pembayaran terpisah untuk satu meja

## Catatan Penting

- Fitur ini dirancang untuk restoran/kafe dengan sistem dine-in
- Untuk takeaway, sistem tetap berjalan normal tanpa pemilihan meja
- Pastikan pelayan terlatih untuk mengelola status meja dengan benar
- Lakukan backup database secara berkala

---

**Dibuat oleh**: Antigravity AI Assistant  
**Tanggal**: 10 Februari 2026  
**Versi**: 1.0.0
