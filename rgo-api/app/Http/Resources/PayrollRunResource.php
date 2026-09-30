<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'branch_id'     => $this->branch_id,
            'period_start'  => $this->period_start?->format('Y-m-d'),
            'period_end'    => $this->period_end?->format('Y-m-d'),
            'currency'      => $this->currency,
            'status'        => $this->status,
            'processed_at'  => optional($this->processed_at)->toIso8601String(),
            'created_by'    => $this->whenLoaded('creator', fn() => $this->creator?->name),
            'approved_by'   => $this->whenLoaded('approver', fn() => $this->approver?->name),
            'total_net'     => (float) $this->items->sum('net_salary'),
            'employee_count'=> $this->items->count(),
            'items'         => PayrollItemResource::collection($this->whenLoaded('items')),
            'created_at'    => optional($this->created_at)->toIso8601String(),
        ];
    }
}
