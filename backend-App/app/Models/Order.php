<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

use App\Traits\BelongsToStore;

class Order extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'user_id',
        'customer_name',
        'customer_notes',
        'member_id',
        'points_earned',
        'points_redeemed',
        'total',
        'subtotal',
        'tax_percentage',
        'tax_amount',
        'tax_inclusive',
        'cogs',
        'profit',
        'payment_method',
        'second_payment_method',
        'paid_amount',
        'second_paid_amount',
        'payment_status',
        'order_type',
        'payment_proof',
        'change_amount',
        'initial_cash',
        'daily_number',
        'status',
        'queue_status',
        'drink_queue_status',
        'notes',
        'hold_reason',
        'drink_hold_reason',
        'queue_completed_at',
        'store_id',
        'table_id',
        'wa_points_status',
        'wa_points_sent_at',
        'delivery_fee',
        'customer_latitude',
        'customer_longitude',
        'delivery_distance_km',
        'customer_address',
    ];

    protected $casts = [
        'payment_proof' => 'array',
        'subtotal' => 'float',
        'tax_percentage' => 'float',
        'tax_amount' => 'float',
        'tax_inclusive' => 'boolean',
        'delivery_fee' => 'integer',
        'customer_latitude' => 'float',
        'customer_longitude' => 'float',
        'delivery_distance_km' => 'float',
    ];

    /**
     * Get the store that the order belongs to.
     */
    public function store()
    {
        return $this->belongsTo(Store::class);
    }
    
    /**
     * Get the user (kasir) who created this order
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get order items
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * Get addon batches (tambahan pesanan setelah pesanan awal) — masing-masing
     * punya status antrian (queue_status/drink_queue_status/hold) independen.
     */
    public function batches(): HasMany
    {
        return $this->hasMany(OrderItemBatch::class);
    }

    /**
     * Get the table assigned to this order
     */
    public function table(): BelongsTo
    {
        return $this->belongsTo(Table::class);
    }

    /**
     * Get the member associated with this order
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    /**
     * Calculate totals for this order
     */
    public function calculateTotals(): void
    {
        $itemsTotal = 0;
        $cogs = 0;

        foreach ($this->items as $item) {
            $itemsTotal += $item->price * $item->quantity;

            $menuItem = $item->menuItem;
            if ($menuItem) {
                $cogs += $menuItem->calculateCOGS() * $item->quantity;
            }
        }

        // Ongkir kena pajak juga, jadi ikut masuk dasar pengenaan pajak.
        $gross = $itemsTotal + (float)($this->delivery_fee ?? 0);

        if ($this->tax_inclusive) {
            // Harga menu SUDAH termasuk pajak: yang ditagih sama dengan harga menu,
            // pajaknya dikeluarkan dari dalam harga tersebut.
            $taxAmount = $this->extractTaxFrom($gross);
            $this->tax_amount = $taxAmount;
            $this->subtotal = $gross - $taxAmount;
            $this->total = $gross;
        } else {
            // Harga menu belum termasuk pajak: pajak ditambahkan di atas harga.
            $taxAmount = $this->computeTaxOn($gross);
            $this->tax_amount = $taxAmount;
            $this->subtotal = $gross;
            $this->total = $gross + $taxAmount;
        }

        $this->cogs = $cogs;
        // Pajak adalah titipan untuk negara, bukan pendapatan toko, jadi laba
        // dihitung dari nilai sebelum pajak.
        $this->profit = (float)$this->subtotal - $cogs;
    }

    /**
     * Keluarkan pajak yang sudah terkandung di dalam sebuah harga (mode inclusive).
     * Memakai tarif yang tersimpan di pesanan ini bila ada.
     */
    public function extractTaxFrom(float $grossAmount): float
    {
        $percentage = (float)($this->tax_percentage ?? 0);

        if ($percentage <= 0) {
            $store = $this->store;
            if (!$store) {
                return 0.0;
            }
            $percentage = $store->effectiveTaxPercentage();
            $this->tax_percentage = $percentage;
        }

        if ($percentage <= 0 || $grossAmount <= 0) {
            return 0.0;
        }

        return round($grossAmount * $percentage / (100 + $percentage));
    }

    /**
     * Hitung pajak memakai tarif yang tersimpan di pesanan ini bila ada
     * (snapshot saat transaksi), kalau belum ada pakai tarif toko saat ini.
     */
    public function computeTaxOn(float $subtotal): float
    {
        $percentage = (float)($this->tax_percentage ?? 0);

        if ($percentage <= 0) {
            $store = $this->store;
            if (!$store) {
                return 0.0;
            }
            $percentage = $store->effectiveTaxPercentage();
            $this->tax_percentage = $percentage;
        }

        if ($percentage <= 0 || $subtotal <= 0) {
            return 0.0;
        }

        return round($subtotal * $percentage / 100);
    }
}
