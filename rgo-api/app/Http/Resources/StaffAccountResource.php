<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StaffAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'email'      => $this->email,
            'branch_id'  => $this->branch_id,
            'employee_id' => $this->employee_id,
            'role'       => $this->getRoleNames()->first(),
            'is_active'  => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
