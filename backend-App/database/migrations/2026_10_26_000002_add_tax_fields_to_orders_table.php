<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pajak disimpan per pesanan (bukan dihitung ulang dari toko) supaya nota lama
     * tetap benar walau tarif pajak toko diubah di kemudian hari.
     *
     * subtotal   = total item (+ongkir) sebelum pajak
     * tax_amount = nilai pajak yang dikenakan
     * total      = subtotal + tax_amount (tetap jadi angka tagihan final)
     *
     * Kolom `subtotal` dan `tax_amount` sudah ada di tabel orders sejak skema awal
     * namun belum pernah dipakai (semuanya 0), jadi di sini hanya tarif pajaknya
     * yang perlu ditambahkan dan kolom lamanya mulai diisi oleh aplikasi.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (!Schema::hasColumn('orders', 'subtotal')) {
                $table->decimal('subtotal', 12, 2)->default(0)->after('total');
            }
            if (!Schema::hasColumn('orders', 'tax_amount')) {
                $table->decimal('tax_amount', 12, 2)->default(0)->after('subtotal');
            }
            if (!Schema::hasColumn('orders', 'tax_percentage')) {
                $table->decimal('tax_percentage', 5, 2)->default(0)->after('subtotal');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('tax_percentage');
        });
    }
};
