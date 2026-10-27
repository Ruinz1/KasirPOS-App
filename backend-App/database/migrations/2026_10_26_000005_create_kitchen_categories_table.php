<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Kategori dapur (mis. Bakso, Nasi Goreng, Mie Goreng) — bebas ditambah per toko.
     *
     * Dibuat terpisah dari kolom `category` di menu_items karena kolom itu sudah
     * dipakai sistem untuk memisah antrian makanan vs minuman (lihat QueueController),
     * jadi tidak bisa dipakai ulang untuk pengelompokan dapur.
     *
     * Gunanya: mengelompokkan item di nota dapur & papan antrian supaya setiap
     * bagian dapur langsung lihat pesanan miliknya.
     */
    public function up(): void
    {
        Schema::create('kitchen_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            // Warna label di antrian/nota supaya tiap bagian dapur mudah dibedakan.
            $table->string('color', 20)->default('orange');
            // Urutan tampil di nota & antrian (kecil = di atas).
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            // Nama kategori unik per toko.
            $table->unique(['store_id', 'name']);
        });

        Schema::table('menu_items', function (Blueprint $table) {
            $table->foreignId('kitchen_category_id')
                ->nullable()
                ->after('category')
                ->constrained('kitchen_categories')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('menu_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('kitchen_category_id');
        });

        Schema::dropIfExists('kitchen_categories');
    }
};
