<?php

namespace App\Jobs;

use App\Models\Order;
use App\Services\MemberPointsMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendOrderPointsWhatsAppJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(private readonly int $orderId)
    {
    }

    public function handle(): void
    {
        $order = Order::with('member', 'store')->find($this->orderId);

        if (!$order || !$order->member) {
            return;
        }

        $storeName = $order->store->name ?? 'toko kami';

        $sent = MemberPointsMessage::sendTransactionPoints(
            $order->member,
            $storeName,
            (float) $order->total,
            (int) ($order->points_earned ?? 0)
        );

        $order->update([
            'wa_points_status' => $sent ? 'sent' : 'failed',
            'wa_points_sent_at' => now(),
        ]);
    }
}
