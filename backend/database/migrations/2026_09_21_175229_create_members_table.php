<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->string('member_code')->nullable()->unique();

            // Personal information
            $table->string('full_name');
            $table->string('cnic')->unique();
            $table->string('cnic_front_path');
            $table->string('cnic_back_path');
            $table->string('contact_number');
            $table->string('email')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();

            // Member type
            $table->enum('member_type', [
                'normal_user',
                'normal_trainer',
                'package_trainer',
                'package_only',
            ])->default('normal_user');

            // Membership details
            $table->foreignId('package_id')->constrained('packages')->restrictOnDelete();
            $table->foreignId('trainer_id')->nullable()->constrained('trainers')->nullOnDelete();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['active', 'expired', 'on_hold'])->default('active');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('members');
    }
};