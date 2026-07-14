<?php

namespace App\Services;

use App\Models\Member;
use App\Models\PointReward;

class MemberPointsMessage
{
    /**
     * Susun daftar reward aktif sebuah toko, urut dari poin terkecil.
     * Reward dengan poin tertinggi yang SUDAH bisa ditukar member di-bold
     * (format WhatsApp: *teks*) supaya member langsung tahu reward terbaiknya.
     */
    public static function rewardList(int $storeId, int $memberPoints): string
    {
        $rewards = PointReward::where('store_id', $storeId)
            ->where('is_active', true)
            ->orderBy('points_required')
            ->get();

        if ($rewards->isEmpty()) {
            return 'berbagai hadiah menarik';
        }

        $highestAffordableId = $rewards
            ->filter(fn ($r) => $r->points_required <= $memberPoints)
            ->sortByDesc('points_required')
            ->first()?->id;

        $list = $rewards
            ->map(function ($r) use ($highestAffordableId) {
                $label = "{$r->name} ({$r->points_required} poin)";

                return $r->id === $highestAffordableId
                    ? "*{$label}* ⭐"
                    : $label;
            })
            ->implode(', ');

        if (mb_strlen($list) > 550) {
            $list = mb_substr($list, 0, 547) . '...';
        }

        return $list;
    }

    /**
     * Kirim notifikasi poin setelah transaksi lunas.
     * Utama: template "poin_transaksi". Fallback: pesan teks bebas
     * (berhasil jika member pernah chat ke nomor bisnis <24 jam).
     */
    public static function sendTransactionPoints(Member $member, string $storeName, float $total, int $pointsEarned): bool
    {
        $totalFormatted = number_format($total, 0, ',', '.');
        $rewardList = self::rewardList($member->store_id, (int) $member->total_points);

        $sent = WhatsAppNotifier::sendTemplate($member->phone, 'poin_transaksi', [
            'customer_name' => $member->name,
            'nama_toko' => $storeName,
            'total_belanja' => $totalFormatted,
            'poin_didapat' => (string) $pointsEarned,
            'total_poin' => (string) $member->total_points,
            'daftar_reward' => $rewardList,
        ]);

        if ($sent) {
            return true;
        }

        $text = "Halo {$member->name}! Terima kasih sudah berbelanja Rp {$totalFormatted} di {$storeName}. "
            . "Anda mendapat {$pointsEarned} poin dari transaksi ini.\n\n"
            . "Total poin Anda sekarang: *{$member->total_points} poin*.\n\n"
            . "Poin bisa ditukar dengan: {$rewardList}\n\n"
            . "Tukarkan poin Anda di kasir saat transaksi berikutnya. Terima kasih!";

        return WhatsAppNotifier::sendText($member->phone, $text);
    }
}
