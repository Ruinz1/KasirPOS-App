# Panduan Implementasi: Edit Metode Pembayaran di Laporan

## Tujuan
Menambahkan fitur edit metode pembayaran, tipe pesanan, dan nomor meja untuk pesanan yang sudah ada di halaman Laporan.

## Status Implementasi

### ✅ Yang Sudah Selesai:

1. **Backend API** - `PUT /api/orders/{order}/details`
   - Endpoint sudah dibuat di `OrderController.php`
   - Method: `updateOrderDetails()`
   - Bisa edit: `payment_method`, `order_type`, `table_id`
   - Validasi lengkap
   - Transaction safe

2. **Component Dialog** - `EditOrderDetailsDialog.tsx`
   - Component reusable sudah dibuat
   - UI visual untuk pilih payment method
   - UI visual untuk pilih order type
   - Dropdown untuk pilih table
   - Error handling
   - Loading states

3. **Import di ReportsPage**
   - `EditOrderDetailsDialog` sudah di-import
   - State `showEditDialog` dan `editingOrder` sudah ditambahkan

### 🔧 Yang Perlu Ditambahkan:

1. **Button Edit di Tabel Transaksi**
2. **Handler Function**
3. **Dialog Component di JSX**

## Langkah Implementasi

### 1. Tambahkan Button Edit di Tabel Transaksi

Cari bagian yang menampilkan list orders (biasanya dalam bentuk tabel atau card). Tambahkan button edit:

```tsx
// Di dalam map orders
{orders.map((order) => (
  <div key={order.id} className="...">
    {/* ... existing order info ... */}
    
    {/* Action Buttons */}
    <div className="flex gap-2">
      {/* Existing buttons (View, Cancel, etc) */}
      
      {/* NEW: Edit Button */}
      <button
        onClick={() => {
          setEditingOrder(order);
          setShowEditDialog(true);
        }}
        className="btn-outline p-2"
        title="Edit Detail Pesanan"
      >
        <Edit2 className="w-4 h-4" />
      </button>
    </div>
  </div>
))}
```

### 2. Tambahkan Dialog Component

Tambahkan sebelum closing `</MainLayout>`:

```tsx
{/* Edit Order Details Dialog */}
<EditOrderDetailsDialog
  open={showEditDialog}
  onOpenChange={setShowEditDialog}
  order={editingOrder}
  onSuccess={() => {
    fetchData(); // Refresh data after edit
    setEditingOrder(null);
  }}
/>
```

### 3. Lokasi File yang Perlu Diedit

**File**: `d:\APP\POS-APP\frontend-app\src\pages\ReportsPage.tsx`

**Baris yang perlu dicari**:
- Cari `orders.map` atau loop yang menampilkan transaksi
- Biasanya ada button dengan icon `Eye` (view) atau `Trash2` (cancel)
- Tambahkan button Edit di sebelahnya

**Contoh Lokasi**:
```tsx
// Sekitar baris 1200-1500 (tergantung struktur file)
<div className="grid gap-4">
  {orders.map((order) => (
    <div className="card-elevated p-4">
      {/* Order info */}
      <div className="flex justify-between">
        <div>...</div>
        <div className="flex gap-2">
          {/* Existing buttons */}
          <button onClick={() => handleViewOrder(order.id)}>
            <Eye className="w-4 h-4" />
          </button>
          
          {/* ADD THIS: Edit button */}
          <button onClick={() => {
            setEditingOrder(order);
            setShowEditDialog(true);
          }}>
            <Edit2 className="w-4 h-4" />
          </button>
          
          <button onClick={() => handleCancelOrder(order)}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  ))}
</div>
```

## Fitur yang Bisa Diedit

### 1. Metode Pembayaran
- Cash
- Card (Kartu)
- QRIS

### 2. Tipe Pesanan
- Dine In
- Takeaway

### 3. Nomor Meja
- Pilih dari meja yang tersedia
- Hanya untuk Dine In
- Opsional (bisa tanpa meja)

## UI/UX Dialog Edit

```
┌─────────────────────────────────────┐
│  Edit Detail Pesanan #12            │
├─────────────────────────────────────┤
│                                     │
│  Tipe Pesanan                       │
│  ┌──────────┐  ┌──────────┐        │
│  │ ☕ Dine  │  │ 🛍️ Take  │        │
│  │   In     │  │   away   │        │
│  └──────────┘  └──────────┘        │
│                                     │
│  Nomor Meja (Opsional)              │
│  ┌─────────────────────────┐       │
│  │ Pilih meja atau kosongkan▼│     │
│  └─────────────────────────┘       │
│                                     │
│  Metode Pembayaran                  │
│  ┌────┐  ┌────┐  ┌────┐            │
│  │💵  │  │💳  │  │📱  │            │
│  │Cash│  │Card│  │QRIS│            │
│  └────┘  └────┘  └────┘            │
│                                     │
│  ┌──────┐  ┌──────────────┐        │
│  │ Batal│  │Simpan Perubahan│      │
│  └──────┘  └──────────────┘        │
└─────────────────────────────────────┘
```

## Skenario Penggunaan

### Skenario 1: Ganti Metode Pembayaran
```
Kasir salah input Cash, seharusnya QRIS
1. Buka halaman Laporan
2. Cari transaksi yang salah
3. Klik button Edit (icon pensil)
4. Dialog muncul
5. Klik "QRIS"
6. Klik "Simpan Perubahan"
✅ Payment method updated
```

### Skenario 2: Tambah Nomor Meja
```
Order awalnya tanpa meja, mau ditambahkan
1. Buka halaman Laporan
2. Cari transaksi
3. Klik Edit
4. Pilih "Meja 5" dari dropdown
5. Simpan
✅ Meja ter-assign, status meja jadi occupied
```

### Skenario 3: Ganti Tipe Pesanan
```
Salah input Dine In, seharusnya Takeaway
1. Buka Laporan
2. Edit transaksi
3. Klik "Takeaway"
4. Simpan
✅ Order type updated, meja di-release (jika ada)
```

## Validasi & Error Handling

### Validasi Backend:
- ✅ Meja harus tersedia (jika dipilih)
- ✅ Payment method harus valid (cash/card/qris)
- ✅ Order type harus valid (dine_in/takeaway)
- ✅ User authorization (kasir hanya bisa edit pesanan sendiri)

### Error Messages:
| Error | Pesan | Solusi |
|-------|-------|--------|
| Meja terisi | "Meja sudah terisi oleh pesanan lain" | Pilih meja lain |
| Unauthorized | "Unauthorized" | Hanya bisa edit pesanan sendiri |
| Invalid method | "Invalid payment method" | Pilih method yang valid |

## Testing Checklist

- [ ] Button Edit tampil di setiap transaksi
- [ ] Dialog muncul saat klik Edit
- [ ] Bisa ganti payment method
- [ ] Bisa ganti order type
- [ ] Bisa ganti/tambah nomor meja
- [ ] Validasi meja tersedia
- [ ] Error handling bekerja
- [ ] Data refresh setelah edit
- [ ] Toast notification muncul
- [ ] Authorization bekerja (kasir vs admin)

## Code Snippets Lengkap

### Button Edit (Tambahkan di tabel transaksi):
```tsx
<button
  onClick={() => {
    setEditingOrder(order);
    setShowEditDialog(true);
  }}
  className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
  title="Edit Detail Pesanan"
>
  <Edit2 className="w-4 h-4 text-muted-foreground hover:text-primary" />
</button>
```

### Dialog Component (Tambahkan sebelum </MainLayout>):
```tsx
{/* Edit Order Details Dialog */}
<EditOrderDetailsDialog
  open={showEditDialog}
  onOpenChange={setShowEditDialog}
  order={editingOrder}
  onSuccess={() => {
    fetchData(); // Refresh data
    setEditingOrder(null);
    toast.success('Detail pesanan berhasil diperbarui');
  }}
/>
```

## Integrasi dengan Fitur Lain

### 1. Dengan Sistem Meja
- Saat ganti ke Dine In → bisa pilih meja
- Saat ganti ke Takeaway → meja otomatis di-release
- Meja lama otomatis jadi available
- Meja baru otomatis jadi occupied

### 2. Dengan Queue Page
- Setelah edit, badge meja di queue otomatis update
- Tipe pesanan di queue otomatis update

### 3. Dengan Reports
- Data laporan otomatis refresh
- Excel export akan include data terbaru

## Estimasi Waktu
- Implementasi: 15-20 menit
- Testing: 10-15 menit
- Total: ~30 menit

## Prioritas
**HIGH** - Fitur ini sangat berguna untuk koreksi kesalahan input

## Notes
- Component `EditOrderDetailsDialog` sudah dibuat dan siap pakai
- Backend API sudah ready
- Tinggal tambahkan button dan dialog di ReportsPage
- Bisa juga ditambahkan di halaman lain yang menampilkan list orders
