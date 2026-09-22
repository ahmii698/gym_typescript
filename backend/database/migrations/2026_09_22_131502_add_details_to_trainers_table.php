<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('trainers', function (Blueprint $table) {
            $table->string('cnic')->nullable()->unique()->after('name');
            $table->string('role')->default('Fitness Trainer')->after('specialization');
            $table->string('status')->default('Active')->after('role');
            $table->unsignedInteger('experience_years')->nullable()->after('status');
            $table->string('photo_url')->nullable()->after('experience_years');
        });
    }

    public function down(): void
    {
        Schema::table('trainers', function (Blueprint $table) {
            $table->dropColumn(['cnic', 'role', 'status', 'experience_years', 'photo_url']);
        });
    }
};