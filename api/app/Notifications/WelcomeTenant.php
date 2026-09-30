<?php

namespace App\Notifications;

use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WelcomeTenant extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Tenant $tenant)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Welcome to RestaurantGo, {$this->tenant->name}!")
            ->greeting("Hi {$notifiable->name},")
            ->line("Your account for **{$this->tenant->name}** is ready, with a 3-month free trial.")
            ->line('You can start adding your menu, branches, and team right away.')
            ->action('Go to your dashboard', config('app.public_url'))
            ->salutation('— The RestaurantGo Team');
    }
}
