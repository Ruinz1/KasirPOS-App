<?php

namespace App\Jobs;

use App\Models\Member;
use App\Services\MemberPointsMessage;
use App\Services\WhatsAppNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendMemberPointsInfoJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(private readonly int $memberId, private readonly string $storeName)
    {
    }

    public function handle(): void
    {
        $member = Member::find($this->memberId);

        if (!$member) {
            return;
        }

        $rewardList = MemberPointsMessage::rewardList($member->store_id, (int) $member->total_points);

        $sent = WhatsAppNotifier::sendTemplate($member->phone, 'info_poin', [
            'customer_name' => $member->name,
            'nama_toko' => $this->storeName,
            'total_poin' => (string) $member->total_points,
            'daftar_reward' => $rewardList,
        ]);

        if ($sent) {
            $member->update([
                'wa_info_status' => 'sent',
                'wa_info_method' => 'template',
                'wa_info_sent_at' => now(),
            ]);

            return;
        }

        $text = "Halo {$member->name}! Poin Anda di {$this->storeName} saat ini: {$member->total_points} poin.\n\n"
            . "Setiap belanja Rp 10.000 = 1 poin.\n\n"
            . "Poin bisa ditukar dengan: {$rewardList}.\n\n"
            . "Tunjukkan pesan ini ke kasir untuk menukar poin Anda. Terima kasih!";

        $sentAsText = WhatsAppNotifier::sendText($member->phone, $text);

        $member->update([
            'wa_info_status' => $sentAsText ? 'sent' : 'failed',
            'wa_info_method' => $sentAsText ? 'text' : null,
            'wa_info_sent_at' => now(),
        ]);
    }
}
