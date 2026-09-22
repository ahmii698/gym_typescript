<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drink_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drink_id')->constrained()->onDelete('cascade');
            $table->foreignId('sold_by')->nullable()->constrained('users')->onDelete('set null');
            $table->integer('quantity');
            $table->decimal('total_price', 8, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drink_sales');
    }
};