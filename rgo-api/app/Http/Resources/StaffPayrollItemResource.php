<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StaffPayrollItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'staff_id'     => $this->staff_id,
            'staff_name'   => $this->whenLoaded('staff', fn () => $this->staff?->name),
            'position'     => $this->whenLoaded('staff', fn () => $this->staff?->position),
            'hours_worked' => (float) $this->hours_worked,
            'base_salary'  => (float) $this->base_salary,
            'overtime_pay' => (float) $this->overtime_pay,
            'bonuses'      => (float) $this->bonuses,
            'deductions'   => (float) $this->deductions,
            'net_salary'   => (float) $this->net_salary,
            'notes'        => $this->notes,
        ];
    }
}
