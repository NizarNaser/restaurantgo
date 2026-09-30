<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'national_id' => $this->national_id,
            'phone' => $this->phone,
            'email' => $this->email,
            'position' => $this->position,
            'base_salary' => $this->base_salary,
            'currency' => $this->currency ?? 'USD',
            'hire_date' => $this->hire_date?->format('Y-m-d'),
            'status' => $this->status,
            'overtime_rate' => $this->overtime_rate,
            'notes' => $this->notes,
        ];
    }
}
