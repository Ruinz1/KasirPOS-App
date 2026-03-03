# Panduan Implementasi: Pemilihan Meja Sebelum Pembayaran

## Tujuan
Memungkinkan kasir untuk memilih nomor meja **sebelum** pembayaran, bukan setelahnya.

## Perubahan yang Diperlukan

### 1. Tambahkan State Baru di POSPage.tsx

Tambahkan state untuk menyimpan meja yang dipilih sebelum bayar:

```tsx
const [preSelectedTableId, setPreSelectedTableId] = useState<number | null>(null);
```

### 2. Tambahkan Dropdown Pemilihan Meja di Cart Section

Tambahkan setelah toggle sistem meja (sekitar baris 1710):

```tsx
{/* Table Selection - Show when table system is ON */}
{orderType === 'dine_in' && useTableSystem && (
  <div className="mb-6">
    <label className="text-sm text-muted-foreground mb-2 block">
      Pilih Nomor Meja (Opsional)
    </label>
    <Select 
      value={preSelectedTableId?.toString() || ''} 
      onValueChange={(val) => {
        setPreSelectedTableId(val ? parseInt(val) : null);
        // Fetch latest tables when opening dropdown
        if (!availableTables.length) {
          fetchAvailableTables();
        }
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Pilih meja atau kosongkan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Tanpa Meja (Pilih Nanti)</SelectItem>
        {availableTables
          .filter(t => t.status === 'available')
          .map((table) => (
            <SelectItem key={table.id} value={table.id.toString()}>
              🪑 Meja {table.table_number} ({table.capacity} kursi)
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
    {preSelectedTableId && (
      <p className="text-xs text-primary mt-2 flex items-center gap-1">
        <Check className="w-3 h-3" />
        Meja {availableTables.find(t => t.id === preSelectedTableId)?.table_number} dipilih
      </p>
    )}
  </div>
)}
```

### 3. Update handleCheckout Function

Modifikasi logika checkout untuk menggunakan preSelectedTableId:

Cari bagian ini (sekitar baris 766-786):

```tsx
if (paymentStatus === 'paid' && orderType === 'dine_in' && useTableSystem) {
  setPendingOrderForTable(response.data);
  await fetchAvailableTables();
  setShowTableSelection(true);
  toast.info('Pilih nomor meja untuk pesanan ini');
}
```

Ganti dengan:

```tsx
if (paymentStatus === 'paid' && orderType === 'dine_in' && useTableSystem) {
  // Jika meja sudah dipilih sebelumnya, langsung assign
  if (preSelectedTableId) {
    try {
      await api.post(`/tables/${preSelectedTableId}/assign`, {
        order_id: response.data.id
      });
      toast.success(`Pesanan berhasil ditetapkan ke Meja ${availableTables.find(t => t.id === preSelectedTableId)?.table_number}`);
      setPreSelectedTableId(null); // Reset selection
      
      // Show receipt
      setShowReceipt(true);
      setReceiptMode('customer');
      // Auto print logic...
    } catch (error: any) {
      console.error('Failed to assign table:', error);
      toast.error(error.response?.data?.message || 'Gagal menetapkan meja');
      // Fallback: show table selection dialog
      setPendingOrderForTable(response.data);
      await fetchAvailableTables();
      setShowTableSelection(true);
    }
  } else {
    // Jika belum pilih meja, tampilkan dialog seperti biasa
    setPendingOrderForTable(response.data);
    await fetchAvailableTables();
    setShowTableSelection(true);
    toast.info('Pilih nomor meja untuk pesanan ini');
  }
}
```

### 4. Reset preSelectedTableId Saat Clear Cart

Tambahkan di function `handleClearCart()`:

```tsx
const handleClearCart = () => {
  setCart([]);
  setCustomerName('');
  setEditingOrderId(null);
  setAddToOrderId(null);
  setPreSelectedTableId(null); // ← Tambahkan ini
};
```

### 5. Fetch Tables Saat Component Mount

Tambahkan useEffect untuk fetch tables saat pertama kali load:

```tsx
useEffect(() => {
  if (user) {
    fetchMenuItems();
    fetchAvailableTables(); // ← Tambahkan ini
  }
}, [user]);
```

## Alur Kerja Baru

### Skenario 1: Pilih Meja Sebelum Bayar
```
1. Kasir input pesanan Dine In
2. Toggle "Sistem Meja" ON
3. Dropdown "Pilih Nomor Meja" muncul
4. Kasir pilih "Meja 5"
5. Tampil konfirmasi: "✓ Meja 5 dipilih"
6. Kasir klik "Bayar"
7. Sistem langsung assign ke Meja 5
8. Cetak struk
9. Meja 5 status jadi "Terisi"
```

### Skenario 2: Pilih Meja Setelah Bayar (Seperti Sekarang)
```
1. Kasir input pesanan Dine In
2. Toggle "Sistem Meja" ON
3. Dropdown kosong (tidak pilih meja)
4. Kasir klik "Bayar"
5. Dialog pemilihan meja muncul
6. Kasir pilih meja
7. Assign dan cetak struk
```

### Skenario 3: Tanpa Sistem Meja
```
1. Kasir input pesanan Dine In
2. Toggle "Sistem Meja" OFF
3. Dropdown tidak muncul
4. Kasir klik "Bayar"
5. Langsung cetak struk
6. Masuk antrian tanpa meja
```

## Keuntungan

1. ✅ **Lebih Cepat**: Kasir bisa pilih meja sambil input pesanan
2. ✅ **Fleksibel**: Bisa pilih sebelum atau sesudah bayar
3. ✅ **Jelas**: Kasir tahu meja mana yang akan dipakai
4. ✅ **Validasi Real-time**: Hanya tampil meja yang tersedia
5. ✅ **Update Otomatis**: Status meja langsung berubah

## Testing

### Test Case 1: Pre-select Table
- Input pesanan
- Pilih Meja 5 dari dropdown
- Bayar
- Expected: Langsung assign ke Meja 5, tidak ada dialog

### Test Case 2: No Pre-selection
- Input pesanan
- Tidak pilih meja
- Bayar
- Expected: Dialog pemilihan meja muncul

### Test Case 3: Table Becomes Unavailable
- Pilih Meja 5
- Meja 5 diisi oleh kasir lain
- Bayar
- Expected: Error, fallback ke dialog pemilihan meja

### Test Case 4: Clear Cart
- Pilih Meja 5
- Clear cart
- Expected: Pilihan meja di-reset

## UI/UX

### Dropdown Meja
```
┌─────────────────────────────────┐
│ Pilih Nomor Meja (Opsional)     │
├─────────────────────────────────┤
│ ▼ Pilih meja atau kosongkan     │
└─────────────────────────────────┘

Dropdown Options:
- Tanpa Meja (Pilih Nanti)
- 🪑 Meja 1 (4 kursi)
- 🪑 Meja 2 (2 kursi)
- 🪑 Meja 5 (6 kursi)
```

### Konfirmasi Pilihan
```
✓ Meja 5 dipilih
```

## Catatan Implementasi

1. **Import yang Diperlukan**: Pastikan `Check` icon sudah di-import dari `lucide-react`
2. **Error Handling**: Jika assign gagal, fallback ke dialog pemilihan meja
3. **Reset State**: Jangan lupa reset `preSelectedTableId` setelah assign atau clear cart
4. **Fetch Tables**: Fetch tables saat component mount dan saat buka dropdown
5. **Filter Available**: Hanya tampilkan meja dengan status 'available'

## File yang Perlu Dimodifikasi

1. `frontend-app/src/pages/POSPage.tsx`
   - Tambah state `preSelectedTableId`
   - Tambah dropdown di cart section
   - Update `handleCheckout` logic
   - Update `handleClearCart`
   - Tambah fetch tables di useEffect

## Estimasi Waktu
- Implementasi: 30-45 menit
- Testing: 15-20 menit
- Total: ~1 jam

## Prioritas
**HIGH** - Fitur ini akan sangat meningkatkan efisiensi kasir
