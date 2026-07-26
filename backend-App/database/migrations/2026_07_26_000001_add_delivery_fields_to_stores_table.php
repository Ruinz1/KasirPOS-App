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
        Schema::table('stores', function (Blueprint $table) {
            $table->double('latitude')->nullable()->after('location');
            $table->double('longitude')->nullable()->after('latitude');
            $table->unsignedInteger('delivery_base_fee')->default(0)->after('longitude');
            $table->unsignedInteger('delivery_fee_per_km')->default(2000)->after('delivery_base_fee');
            $table->unsignedInteger('delivery_max_km')->nullable()->after('delivery_fee_per_km');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn([
                'latitude',
                'longitude',
                'delivery_base_fee',
                'delivery_fee_per_km',
                'delivery_max_km',
            ]);
        });
    }
};
