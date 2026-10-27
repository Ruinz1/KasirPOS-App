<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Mode perhitungan pajak:
     *  - false (exclusive): harga menu BELUM termasuk pajak; pajak ditambahkan di atas harga.
     *  - true  (inclusive): harga menu SUDAH termasuk pajak; pajak dihitung mundur dari harga,
     *    sehingga yang dibayar pelanggan sama persis dengan harga yang tertera di menu.
     */
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->boolean('tax_inclusive')->default(false)->after('tax_name');
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('tax_inclusive');
        });
    }
};
