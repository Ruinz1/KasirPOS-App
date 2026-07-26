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
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('delivery_fee')->nullable()->after('change_amount');
            $table->double('customer_latitude')->nullable()->after('delivery_fee');
            $table->double('customer_longitude')->nullable()->after('customer_latitude');
            $table->decimal('delivery_distance_km', 8, 2)->nullable()->after('customer_longitude');
            $table->string('customer_address')->nullable()->after('delivery_distance_km');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'delivery_fee',
                'customer_latitude',
                'customer_longitude',
                'delivery_distance_km',
                'customer_address',
            ]);
        });
    }
};
