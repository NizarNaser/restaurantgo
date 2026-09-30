<?php

namespace App\Notifications;

use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class GdprExportReady extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Tenant $tenant,
        private readonly string $filename,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = URL::temporarySignedRoute(
            'gdpr.export.download',
            now()->addHours(24),
            ['tenant' => $this->tenant->id, 'filename' => $this->filename],
        );

        return (new MailMessage)
            ->subject("Your {$this->tenant->name} data export is ready")
            ->greeting("Hi {$notifiable->name},")
            ->line('The data export you requested is ready to download.')
            ->action('Download export', $url)
            ->line('This link expires in 24 hours, for security.')
            ->salutation('— The RestaurantGo Team');
    }
}
