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
        Schema::table('users', function (Blueprint $table) {
            $table->json('positions')->nullable(); // Multiple positions as JSON array
            $table->enum('salary_type', ['auto', 'manual'])->default('auto');
            $table->decimal('base_salary', 10, 2)->nullable(); // For manual salary type
            $table->decimal('bonus', 10, 2)->default(0); // Owner can add bonus
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['positions', 'salary_type', 'base_salary', 'bonus']);
        });
    }
};
