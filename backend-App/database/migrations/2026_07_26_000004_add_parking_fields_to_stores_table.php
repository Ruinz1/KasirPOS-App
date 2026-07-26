<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->integer('parking_fee_motor')->default(2000)->after('delivery_max_km');
            $table->integer('parking_fee_mobil')->default(5000)->after('parking_fee_motor');
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn(['parking_fee_motor', 'parking_fee_mobil']);
        });
    }
};
