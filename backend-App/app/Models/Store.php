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
    ];

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
