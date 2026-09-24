<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drinks', function (Blueprint $table) {
            // Khareed price (jo dukaan/supplier ko diya). Selling price already 'price' column mein hai.
            $table->decimal('cost_price', 10, 2)->default(0)->after('price');
        });
    }

    public function down(): void
    {
        Schema::table('drinks', function (Blueprint $table) {
            $table->dropColumn('cost_price');
        });
    }
};