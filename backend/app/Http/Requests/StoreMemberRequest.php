<?php

namespace App\Http\Requests;

use App\Models\Member;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $needsTrainer = in_array($this->input('member_type'), Member::TRAINER_TYPES, true);

        return [
            // Personal information
            'full_name'      => ['required', 'string', 'max:255'],
            'cnic'           => ['required', 'regex:/^\d{5}-\d{7}-\d$/', 'unique:members,cnic'],
            'cnic_front'     => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'cnic_back'      => ['required', 'image', 'mimes:jpg,jpeg,png', 'max:2048'],
            'contact_number' => ['required', 'regex:/^03\d{2}-?\d{7}$/'],
            'email'          => ['nullable', 'email', 'max:255'],
            'date_of_birth'  => ['nullable', 'date', 'before:today'],
            'gender'         => ['nullable', Rule::in(['male', 'female', 'other'])],

            // Membership details
            'package_id'     => ['required', 'exists:packages,id'],
            'start_date'     => ['required', 'date'],
            'end_date'       => ['nullable', 'date', 'after_or_equal:start_date'],
            'notes'          => ['nullable', 'string', 'max:1000'],

            // Member type + trainer
            'member_type'    => ['required', Rule::in(Member::TYPES)],
            'trainer_id'     => [$needsTrainer ? 'required' : 'nullable', 'exists:trainers,id'],

            // Payment
            'fee_amount'     => ['nullable', 'numeric', 'min:0'],
            'payment_status' => ['nullable', Rule::in(['paid', 'pending', 'partial'])],
        ];
    }

    public function messages(): array
    {
        return [
            'cnic.regex'           => 'CNIC format XXXXX-XXXXXXX-X hona chahiye.',
            'cnic.unique'          => 'Is CNIC ka member pehle se registered hai.',
            'contact_number.regex' => 'Contact number format 03XX-XXXXXXX hona chahiye.',
            'cnic_front.max'       => 'CNIC front image 2MB se zyada nahi honi chahiye.',
            'cnic_back.max'        => 'CNIC back image 2MB se zyada nahi honi chahiye.',
            'trainer_id.required'  => 'Is member type ke liye trainer select karna zaroori hai.',
        ];
    }
}