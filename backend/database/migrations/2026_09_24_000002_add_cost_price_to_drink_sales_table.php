<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drink_sales', function (Blueprint $table) {
            // Sale ke waqt ki cost price save karo, taake baad mein cost badle to
            // purani sales ka profit calculation ghalat na ho.
            $table->decimal('cost_price', 10, 2)->default(0)->after('quantity');
        });
    }

    public function down(): void
    {
        Schema::table('drink_sales', function (Blueprint $table) {
            $table->dropColumn('cost_price');
        });
    }
};