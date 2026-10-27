<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\BelongsToStore;

/**
 * Kategori dapur (mis. Bakso, Nasi Goreng, Mie Goreng) — bebas ditambah per toko.
 *
 * Dipakai untuk mengelompokkan item di nota dapur & papan antrian. Berbeda dari
 * kolom `category` di menu_items yang dipakai sistem untuk memisah antrian
 * makanan vs minuman.
 */
class KitchenCategory extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'store_id',
        'name',
        'color',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    /**
     * Warna label yang boleh dipakai — dibatasi agar tampilan antrian tetap konsisten
     * dan kelas Tailwind-nya bisa dipetakan statis di frontend.
     */
    public const COLORS = [
        'orange', 'red', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'slate',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function menuItems(): HasMany
    {
        return $this->hasMany(MenuItem::class, 'kitchen_category_id');
    }
}
