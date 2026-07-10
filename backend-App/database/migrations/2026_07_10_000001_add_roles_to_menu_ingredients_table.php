<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('menu_ingredients', function (Blueprint $table) {
            // Peran bahan pada sebuah menu:
            //  - fixed    : selalu dipotong (default, sesuai perilaku lama)
            //  - option   : bagian dari grup "Tipe" (pilih satu, hanya yang dipilih dipotong)
            //  - optional : checkbox di keranjang, default tercentang (bisa dihilangkan per pesanan)
            $table->string('role')->default('fixed')->after('amount');
            // Untuk option: tipe yang terpilih awal. Untuk optional: tercentang awal.
            $table->boolean('is_default')->default(true)->after('role');
            // Nama pendek untuk kasir (mis. "Halus", "Mie Kuning"). Kosong = pakai nama inventory.
            $table->string('label')->nullable()->after('is_default');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('menu_ingredients', function (Blueprint $table) {
            $table->dropColumn(['role', 'is_default', 'label']);
        });
    }
};
