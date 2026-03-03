# Split Bill - Visual Guide

## 📋 Tampilan Detail Tagihan

### 1. **Bill Details Section** (Bagian Atas)
Dialog pembayaran sekarang menampilkan detail lengkap tagihan dengan:

#### Header
- **Detail Tagihan** (title)
- Nama pelanggan & nomor antrian

#### Daftar Item
- Scrollable list (max height 48px)
- Setiap item menampilkan:
  - ✅ Nama menu
  - 📝 Catatan (jika ada) - italic
  - 💰 Harga satuan × Jumlah
  - 💵 Subtotal (bold)
- Border separator antar item
- Background: putih (light) / gray-900 (dark)

#### Total Section
- Background gradient primary
- **TOTAL TAGIHAN** (uppercase, bold)
- Nominal besar (3xl font)
- Info tambahan: jumlah item & porsi total

**Contoh Visual:**
```
┌─────────────────────────────────────┐
│       DETAIL TAGIHAN                │
│    Pelanggan - #123                 │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Kopi Susu                       │ │
│ │ Kuah: Mercon                    │ │
│ │ Rp 15.000 × 2         Rp 30.000 │ │
│ ├─────────────────────────────────┤ │
│ │ Bakso Biasa                     │ │
│ │ Rp 20.000 × 1         Rp 20.000 │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│  TOTAL TAGIHAN      Rp 50.000       │
│  2 item · 3 porsi                   │
└─────────────────────────────────────┘
```

---

## 🎨 Split Bill - Visual Progress Bar

### 2. **Proporsi Pembayaran** (Visual Bar)
Ketika user mengisi jumlah pembayaran, muncul progress bar yang menunjukkan proporsi:

#### Features:
- **Dual-color gradient bar**:
  - 🔵 Biru: Pembayaran 1
  - 🟢 Hijau: Pembayaran 2
- **Percentage display**: Muncul jika > 15% lebar
- **Smooth transition**: Animation 300ms
- **Legend**: Dot indicator + metode pembayaran

**Contoh Visual (50-50):**
```
┌─────────────────────────────────────┐
│     PROPORSI PEMBAYARAN             │
├─────────────────────────────────────┤
│ ┌─────────────────┬─────────────────┐
│ │   CASH 50%      │   QRIS 50%      │
│ │   (Biru)        │   (Hijau)       │
│ └─────────────────┴─────────────────┘
│ 🔵 CASH          🟢 QRIS            │
└─────────────────────────────────────┘
```

**Contoh Visual (70-30):**
```
┌─────────────────────────────────────┐
│     PROPORSI PEMBAYARAN             │
├─────────────────────────────────────┤
│ ┌─────────────────────────┬─────────┐
│ │      CASH 70%           │ QRIS 30%│
│ │      (Biru)             │ (Hijau) │
│ └─────────────────────────┴─────────┘
│ 🔵 CASH          🟢 QRIS            │
└─────────────────────────────────────┘
```

---

## 📊 Ringkasan Pembayaran (Enhanced Summary)

### 3. **Detailed Breakdown**
Panel ringkasan yang lebih informatif dengan color coding:

#### Pembayaran 1 (Blue Panel)
- Background: `bg-blue-50` (light) / `bg-blue-950/30` (dark)
- Dot indicator biru
- Label "Pembayaran 1"
- Badge metode (CASH/KARTU/QRIS)
- Nominal dengan warna biru

#### Pembayaran 2 (Green Panel)
- Background: `bg-green-50` (light) / `bg-green-950/30` (dark)
- Dot indicator hijau
- Label "Pembayaran 2"
- Badge metode (CASH/KARTU/QRIS)
- Nominal dengan warna hijau

#### Total Section
- Border dashed separator
- **Total Dibayar** (bold, larger font)
- Color indicator:
  - ✅ Hijau: Jika cukup/lebih
  - ❌ Merah: Jika kurang

#### Kembalian/Kurang Panel
- Conditional rendering (hanya jika ≠ 0)
- Background & border:
  - 💚 Success (hijau): Kembalian
  - 🔴 Destructive (merah): Kurang bayar
- Emoji indicator:
  - 💰 Kembalian
  - ⚠️ Kurang Bayar
- Nominal besar (text-lg, font-black)

#### Target Tagihan
- Small panel di bawah
- Background: `bg-primary/5`
- Menampilkan target yang harus dicapai

**Contoh Visual (Cukup dengan Kembalian):**
```
┌─────────────────────────────────────┐
│    RINGKASAN PEMBAYARAN             │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔵 Pembayaran 1  [CASH]         │ │
│ │                      Rp 30.000  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 Pembayaran 2  [QRIS]         │ │
│ │                      Rp 30.000  │ │
│ └─────────────────────────────────┘ │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ Total Dibayar:          Rp 60.000  │
├─────────────────────────────────────┤
│ 💰 Kembalian:           Rp 10.000  │
│     (hijau, bold)                   │
├─────────────────────────────────────┤
│ Target Tagihan:         Rp 50.000  │
└─────────────────────────────────────┘
```

**Contoh Visual (Kurang Bayar):**
```
┌─────────────────────────────────────┐
│    RINGKASAN PEMBAYARAN             │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔵 Pembayaran 1  [CASH]         │ │
│ │                      Rp 20.000  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 Pembayaran 2  [QRIS]         │ │
│ │                      Rp 20.000  │ │
│ └─────────────────────────────────┘ │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ Total Dibayar:          Rp 40.000  │
│     (merah)                         │
├─────────────────────────────────────┤
│ ⚠️ Kurang Bayar:        Rp 10.000  │
│     (merah, bold)                   │
├─────────────────────────────────────┤
│ Target Tagihan:         Rp 50.000  │
└─────────────────────────────────────┘
```

---

## 🎯 User Flow dengan Visual yang Jelas

### Skenario: Split Bill Rp 100.000 (Cash + QRIS)

**Step 1: Lihat Detail Bill**
```
User membuka dialog pembayaran
↓
Melihat daftar item yang dibeli:
- Kopi Susu × 2 = Rp 30.000
- Bakso × 3 = Rp 60.000
- Snack × 2 = Rp 10.000
↓
Total jelas: Rp 100.000
```

**Step 2: Aktifkan Split Bill**
```
Toggle switch ON
↓
Muncul 2 panel:
- Panel Biru (Pembayaran 1)
- Panel Hijau (Pembayaran 2)
```

**Step 3: Input Pembayaran 1**
```
Pilih: CASH
Klik: 50% button
↓
Terisi: Rp 50.000
↓
Progress bar muncul: 100% biru (karena pembayaran 2 = 0)
```

**Step 4: Input Pembayaran 2**
```
Pilih: QRIS
Klik: "Isi Sisa" button
↓
Terisi: Rp 50.000
↓
Progress bar update: 50% biru | 50% hijau
```

**Step 5: Lihat Ringkasan**
```
Proporsi Pembayaran:
[████████████████|████████████████]
   CASH 50%     |    QRIS 50%

Ringkasan:
🔵 Pembayaran 1 [CASH]  Rp 50.000
🟢 Pembayaran 2 [QRIS]  Rp 50.000
─────────────────────────────────
Total Dibayar:          Rp 100.000 ✅
Target Tagihan:         Rp 100.000
```

**Step 6: Konfirmasi**
```
Button enabled (hijau)
↓
Klik "Konfirmasi Split Bill"
↓
Toast: "Pembayaran berhasil! Split: Rp 50.000 (CASH) + Rp 50.000 (QRIS)"
```

---

## 🎨 Color Scheme

### Light Mode
- **Pembayaran 1**: Blue
  - Panel: `bg-blue-50`
  - Border: `border-blue-200`
  - Text: `text-blue-700`
  - Progress: `from-blue-400 to-blue-500`

- **Pembayaran 2**: Green
  - Panel: `bg-green-50`
  - Border: `border-green-200`
  - Text: `text-green-700`
  - Progress: `from-green-400 to-green-500`

### Dark Mode
- **Pembayaran 1**: Blue
  - Panel: `bg-blue-950/20`
  - Border: `border-blue-800`
  - Text: `text-blue-400`
  - Progress: `from-blue-600 to-blue-700`

- **Pembayaran 2**: Green
  - Panel: `bg-green-950/20`
  - Border: `border-green-800`
  - Text: `text-green-400`
  - Progress: `from-green-600 to-green-700`

---

## ✨ Key Visual Improvements

1. **📋 Bill Details**: User tahu persis apa yang dibeli
2. **📊 Progress Bar**: Visual proporsi pembayaran yang intuitif
3. **🎨 Color Coding**: Biru vs Hijau untuk membedakan 2 pembayaran
4. **💰 Kembalian Highlight**: Jelas terlihat dengan emoji & warna
5. **⚠️ Validasi Visual**: Merah jika kurang, hijau jika cukup
6. **🎯 Target Comparison**: Selalu tahu target yang harus dicapai

Semua elemen visual ini membuat kasir dan pelanggan lebih mudah memahami breakdown pembayaran split bill!
