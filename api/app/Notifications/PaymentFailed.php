<?php

namespace App\Notifications;

use App\Services\Currency;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PaymentFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly ?float $amount = null,
        private readonly ?string $currency = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject('Your RestaurantGo payment failed')
            ->greeting("Hi {$notifiable->name},")
            ->line('We were unable to process your latest subscription payment.');

        if ($this->amount !== null) {
            $decimals = Currency::decimals($this->currency ?? 'USD');
            $message->line('Amount due: '.number_format($this->amount, $decimals).' '.strtoupper($this->currency ?? ''));
        }

        return $message
            ->line('Please update your payment method to avoid any interruption to your account.')
            ->action('Update payment method', url('/billing'))
            ->salutation('— The RestaurantGo Team');
    }
}
