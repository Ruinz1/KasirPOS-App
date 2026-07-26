<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Toko yang belum pernah mengubah tarif (masih default lama 5000) ikut turun ke 3000
        DB::table('stores')->where('parking_fee_mobil', 5000)->update(['parking_fee_mobil' => 3000]);
    }

    public function down(): void
    {
        DB::table('stores')->where('parking_fee_mobil', 3000)->update(['parking_fee_mobil' => 5000]);
    }
};
