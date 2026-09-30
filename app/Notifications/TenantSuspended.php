<?php

namespace App\Notifications;

use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TenantSuspended extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Tenant $tenant, private readonly ?string $reason = null)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject("Your {$this->tenant->name} account has been suspended")
            ->greeting("Hi {$notifiable->name},")
            ->line("Access to your RestaurantGo account for **{$this->tenant->name}** has been suspended.");

        if ($this->reason) {
            $message->line("Reason: {$this->reason}");
        }

        return $message
            ->line('If you believe this is a mistake, please contact support.')
            ->salutation('— The RestaurantGo Team');
    }
}
