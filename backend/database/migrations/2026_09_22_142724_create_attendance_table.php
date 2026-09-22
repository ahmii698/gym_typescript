<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance', function (Blueprint $table) {
            $table->id();
            $table->foreignId('member_id')->constrained('members')->onDelete('cascade');
            $table->date('date');                       // kis din ki attendance hai
            $table->enum('status', ['Present', 'Absent'])->default('Absent');
            $table->time('check_in')->nullable();        // check-in time (agar present hai to)
            $table->timestamps();

            // ek member ki ek din mein sirf aik attendance row ho
            $table->unique(['member_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance');
    }
};