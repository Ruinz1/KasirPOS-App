<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pisahkan alasan hold minuman dari makanan.
     * Sebelumnya hold makanan & minuman berbagi satu kolom hold_reason,
     * sehingga hold/resume minuman menimpa/menghapus alasan hold makanan.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('drink_hold_reason')->nullable()->after('hold_reason');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('drink_hold_reason');
        });
    }
};
