<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pajak per toko: tiap toko punya tarif sendiri (persen) dan bisa dimatikan.
     * tax_name dipakai sebagai label di nota (mis. "PPN", "Pajak Resto").
     */
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->boolean('tax_enabled')->default(false)->after('daily_target');
            $table->decimal('tax_percentage', 5, 2)->default(0)->after('tax_enabled');
            $table->string('tax_name')->default('Pajak')->after('tax_percentage');
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn(['tax_enabled', 'tax_percentage', 'tax_name']);
        });
    }
};
