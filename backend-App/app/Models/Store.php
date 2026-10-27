<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Store extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'location',
        'owner_id',
        'image',
        'latitude',
        'longitude',
        'delivery_base_fee',
        'delivery_fee_per_km',
        'delivery_max_km',
        'parking_fee_motor',
        'parking_fee_mobil',
        'queue_enabled',
        'parking_checkout_enabled',
        'daily_target',
        'tax_enabled',
        'tax_percentage',
        'tax_name',
        'tax_inclusive',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'delivery_base_fee' => 'integer',
        'delivery_fee_per_km' => 'integer',
        'delivery_max_km' => 'integer',
        'parking_fee_motor' => 'integer',
        'parking_fee_mobil' => 'integer',
        'queue_enabled' => 'boolean',
        'parking_checkout_enabled' => 'boolean',
        'daily_target' => 'integer',
        'tax_enabled' => 'boolean',
        'tax_percentage' => 'float',
        'tax_inclusive' => 'boolean',
    ];

    /**
     * Tarif pajak efektif toko (persen). 0 bila pajak dimatikan.
     */
    public function effectiveTaxPercentage(): float
    {
        if (!$this->tax_enabled) {
            return 0.0;
        }
        return max(0.0, (float)($this->tax_percentage ?? 0));
    }

    /**
     * Hitung nilai pajak dari nilai sebelum pajak (subtotal).
     * Dibulatkan ke rupiah terdekat agar nota tidak menampilkan pecahan sen.
     *
     * Hanya dipakai pada mode exclusive (harga menu belum termasuk pajak).
     * Untuk mode inclusive gunakan extractTax().
     */
    public function calculateTax(float $subtotal): float
    {
        $percentage = $this->effectiveTaxPercentage();
        if ($percentage <= 0 || $subtotal <= 0) {
            return 0.0;
        }
        return round($subtotal * $percentage / 100);
    }

    /**
     * Mode pajak: harga menu sudah termasuk pajak atau belum.
     */
    public function isTaxInclusive(): bool
    {
        return (bool) $this->tax_inclusive;
    }

    /**
     * Keluarkan nilai pajak yang SUDAH terkandung di dalam sebuah harga.
     *
     * Mis. harga Rp 110.000 dengan PPN 10% -> pajaknya Rp 10.000 dan
     * dasar pengenaan pajaknya Rp 100.000. Rumus: harga x p / (100 + p).
     */
    public function extractTax(float $grossAmount): float
    {
        $percentage = $this->effectiveTaxPercentage();
        if ($percentage <= 0 || $grossAmount <= 0) {
            return 0.0;
        }
        return round($grossAmount * $percentage / (100 + $percentage));
    }

    /**
     * Label pajak untuk ditampilkan di nota, mis. "PPN 11%".
     */
    public function taxLabel(): string
    {
        $name = $this->tax_name ?: 'Pajak';
        $percentage = $this->effectiveTaxPercentage();
        return $percentage > 0
            ? $name . ' ' . rtrim(rtrim(number_format($percentage, 2, '.', ''), '0'), '.') . '%'
            : $name;
    }

    /**
     * Hitung jarak Haversine (km) dari koordinat toko ke koordinat pelanggan.
     */
    public function calculateDistance(float $customerLat, float $customerLng): float
    {
        if (!$this->latitude || !$this->longitude) {
            return 0;
        }
        $earthRadius = 6371; // km
        $latDiff = deg2rad($customerLat - $this->latitude);
        $lngDiff = deg2rad($customerLng - $this->longitude);
        $a = sin($latDiff / 2) ** 2 +
             cos(deg2rad($this->latitude)) * cos(deg2rad($customerLat)) * sin($lngDiff / 2) ** 2;
        $c = 2 * asin(sqrt($a));
        return round($earthRadius * $c, 2);
    }

    /**
     * Hitung ongkir berdasarkan jarak (km).
     */
    public function calculateDeliveryFee(float $distanceKm): int
    {
        $base = (int)($this->delivery_base_fee ?? 0);
        $perKm = (int)($this->delivery_fee_per_km ?? 2000);
        return $base + (int)ceil($distanceKm) * $perKm;
    }

    /**
     * Get the owner of the store.
     */
    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * Get the users/employees belonging to the store.
     */
    public function users()
    {
        return $this->hasMany(User::class);
    }

    /**
     * Get orders for the store.
     */
    public function orders()
    {
        return $this->hasMany(Order::class);
    }
    
    /**
     * Get inventory items for the store.
     */
    public function inventoryItems()
    {
        return $this->hasMany(InventoryItem::class);
    }

    /**
     * Kategori dapur milik toko ini (Bakso, Nasi Goreng, dst).
     */
    public function kitchenCategories()
    {
        return $this->hasMany(KitchenCategory::class);
    }

    /**
     * Get parking tickets for the store.
     */
    public function parkingTickets()
    {
        return $this->hasMany(ParkingTicket::class);
    }

    /**
     * Ambil tarif parkir flat berdasarkan jenis kendaraan.
     */
    public function parkingFeeFor(string $vehicleType): int
    {
        return $vehicleType === 'mobil'
            ? (int)($this->parking_fee_mobil ?? 3000)
            : (int)($this->parking_fee_motor ?? 2000);
    }
}
