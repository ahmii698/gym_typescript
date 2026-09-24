<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drink_restocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drink_id')->constrained()->cascadeOnDelete();
            $table->foreignId('restocked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->integer('quantity');
            $table->decimal('cost_price', 10, 2)->nullable(); // us waqt ki cost price
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drink_restocks');
    }
};