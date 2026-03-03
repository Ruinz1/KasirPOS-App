# Sistem Split Bill - POS Application

## Deskripsi
Sistem pembayaran split bill memungkinkan pelanggan membayar satu tagihan menggunakan dua metode pembayaran yang berbeda. Misalnya, sebagian dibayar dengan cash dan sisanya dengan QRIS.

## Fitur Utama

### 1. **Toggle Split Bill**
- Switch toggle yang jelas antara "Pembayaran Tunggal" dan "Split Bill"
- Reset otomatis nilai input saat mode berubah
- Visual feedback dengan animasi smooth

### 2. **Pembayaran Tunggal (Mode Default)**
- Pilihan metode: Cash, Kartu, atau QRIS
- Input manual jumlah uang (khusus Cash)
- **Quick Amount Buttons**: Tombol cepat untuk nominal 20k, 50k, 100k, 200k
- Kalkulasi kembalian otomatis
- Validasi: uang yang dibayar harus >= total tagihan

### 3. **Split Bill Mode**
- **Pembayaran Pertama** (Background Biru):
  - Pilih metode pembayaran (Cash/Kartu/QRIS)
  - Input jumlah pembayaran pertama
  - Quick buttons: 50%, 30%, 70% dari total tagihan
  
- **Pembayaran Kedua** (Background Hijau):
  - Pilih metode pembayaran (Cash/Kartu/QRIS)
  - Input jumlah pembayaran kedua
  - Tombol "Isi Sisa": otomatis mengisi sisa tagihan setelah pembayaran pertama

- **Summary Panel**:
  - Menampilkan breakdown kedua pembayaran
  - Total yang dibayar
  - Kembalian (jika ada)
  - Visual indicator: hijau jika cukup, merah jika kurang

### 4. **Validasi**
- Total pembayaran harus >= total tagihan
- Kedua pembayaran harus diisi (tidak boleh 0)
- Button disabled jika validasi tidak terpenuhi
- Toast notification untuk error dan success

## Cara Penggunaan

### Pembayaran Tunggal
1. Pilih metode pembayaran (Cash/Kartu/QRIS)
2. Jika Cash: masukkan jumlah uang atau gunakan quick buttons
3. Sistem akan menampilkan kembalian otomatis
4. Klik "Konfirmasi Pembayaran"

### Split Bill
1. Aktifkan toggle "Split Bill"
2. **Pembayaran Pertama**:
   - Pilih metode (misal: Cash)
   - Masukkan jumlah atau gunakan quick button (misal: 50%)
3. **Pembayaran Kedua**:
   - Pilih metode (misal: QRIS)
   - Klik "Isi Sisa" untuk auto-fill sisa tagihan
   - Atau input manual
4. Periksa summary panel
5. Klik "Konfirmasi Split Bill"

## Contoh Skenario

### Skenario 1: Split 50-50
**Tagihan: Rp 100.000**
- Pembayaran 1: Cash Rp 50.000
- Pembayaran 2: QRIS Rp 50.000
- Kembalian: Rp 0

### Skenario 2: Split dengan Kembalian
**Tagihan: Rp 85.000**
- Pembayaran 1: Cash Rp 50.000
- Pembayaran 2: QRIS Rp 50.000
- Total: Rp 100.000
- Kembalian: Rp 15.000

### Skenario 3: Split Custom
**Tagihan: Rp 150.000**
- Pembayaran 1: Kartu Rp 100.000
- Pembayaran 2: Cash Rp 50.000
- Kembalian: Rp 0

## Backend Integration

### Endpoint
```
PUT /api/orders/{id}
```

### Request Payload (Split Bill)
```json
{
  "payment_status": "paid",
  "payment_method": "cash",
  "paid_amount": 50000,
  "second_payment_method": "qris",
  "second_paid_amount": 50000
}
```

### Database Fields
- `payment_method`: Metode pembayaran pertama
- `paid_amount`: Jumlah pembayaran pertama
- `second_payment_method`: Metode pembayaran kedua (nullable)
- `second_paid_amount`: Jumlah pembayaran kedua (nullable)
- `change_amount`: Kembalian total

### Backend Logic (OrderController)
Backend sudah mendukung split payment dengan logika:
1. Jika `second_payment_method` dan `second_paid_amount` ada → Split Bill
2. Total paid = `paid_amount` + `second_paid_amount`
3. Kembalian = Total paid - Total tagihan
4. Status menjadi "paid" jika total paid >= total tagihan

## UI/UX Features

### Visual Design
- **Color Coding**:
  - Biru: Pembayaran pertama
  - Hijau: Pembayaran kedua
  - Hijau: Kembalian/cukup
  - Merah: Kurang bayar
  
- **Responsive**: Dialog scrollable untuk layar kecil
- **Dark Mode**: Fully supported
- **Icons**: Banknote, CreditCard, QrCode untuk visual clarity

### User Experience
- Auto-focus pada input pertama
- Quick buttons untuk input cepat
- Auto-calculate sisa pembayaran
- Real-time validation feedback
- Clear error messages
- Success toast dengan detail split

## State Management

### State Variables
```typescript
const [isSplitBill, setIsSplitBill] = useState(false);
const [splitPayment1Method, setSplitPayment1Method] = useState<'cash' | 'card' | 'qris'>('cash');
const [splitPayment1Amount, setSplitPayment1Amount] = useState<string>('');
const [splitPayment2Method, setSplitPayment2Method] = useState<'cash' | 'card' | 'qris'>('qris');
const [splitPayment2Amount, setSplitPayment2Amount] = useState<string>('');
```

### Reset Logic
- Mode switch → reset amounts
- Successful payment → reset all split states
- Dialog close → preserve state (untuk re-open jika perlu)

## Testing Checklist

- [ ] Toggle switch berfungsi dengan smooth
- [ ] Quick amount buttons mengisi nilai dengan benar
- [ ] Pembayaran tunggal Cash dengan kembalian
- [ ] Pembayaran tunggal QRIS/Kartu (exact amount)
- [ ] Split bill 50-50 Cash + QRIS
- [ ] Split bill dengan kembalian
- [ ] Split bill dengan 2 metode yang sama
- [ ] Validasi: total kurang dari tagihan
- [ ] Validasi: salah satu pembayaran = 0
- [ ] "Isi Sisa" button auto-calculate
- [ ] Quick percentage buttons (30%, 50%, 70%)
- [ ] Dark mode appearance
- [ ] Mobile responsive
- [ ] Toast notifications
- [ ] Backend save split payment correctly

## Troubleshooting

### Issue: Button disabled padahal sudah cukup
**Solusi**: Periksa validasi, pastikan kedua amount > 0

### Issue: Kembalian tidak muncul
**Solusi**: Pastikan total paid > total tagihan

### Issue: Backend error saat save
**Solusi**: Cek migration `second_payment_method` sudah dijalankan

## Future Enhancements
- [ ] Support untuk 3+ metode pembayaran
- [ ] Preset split ratios (custom percentages)
- [ ] History split payments di reports
- [ ] Print receipt dengan detail split
- [ ] Analytics: metode pembayaran paling populer
