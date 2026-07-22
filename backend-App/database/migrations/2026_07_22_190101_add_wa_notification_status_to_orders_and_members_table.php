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
            $table->string('wa_points_status')->nullable()->after('points_redeemed');
            $table->timestamp('wa_points_sent_at')->nullable()->after('wa_points_status');
        });

        Schema::table('members', function (Blueprint $table) {
            $table->string('wa_info_status')->nullable()->after('lifetime_points');
            $table->string('wa_info_method')->nullable()->after('wa_info_status');
            $table->timestamp('wa_info_sent_at')->nullable()->after('wa_info_method');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['wa_points_status', 'wa_points_sent_at']);
        });

        Schema::table('members', function (Blueprint $table) {
            $table->dropColumn(['wa_info_status', 'wa_info_method', 'wa_info_sent_at']);
        });
    }
};
