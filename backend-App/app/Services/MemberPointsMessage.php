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
     * Utama: template "poin_transaksi" (APPROVED di Meta).
     * Fallback 1: template "points_earned" (APPROVED, lebih sederhana tanpa daftar reward).
     * Fallback 2: pesan teks bebas (berhasil jika member chat ke nomor bisnis <24 jam).
     */
    public static function sendTransactionPoints(Member $member, string $storeName, float $total, int $pointsEarned): bool
    {
        $totalFormatted = number_format($total, 0, ',', '.');
        $rewardList = self::rewardList($member->store_id, (int) $member->total_points);

        // Nama & urutan parameter mengikuti body template "poin_transaksi" yang disetujui Meta:
        // customer_name, total_belanja, nama_toko, poin_didapat, total_poin, daftar_reward
        $sent = WhatsAppNotifier::sendTemplate($member->phone, 'poin_transaksi', [
            'customer_name' => $member->name,
            'total_belanja' => $totalFormatted,
            'nama_toko' => $storeName,
            'poin_didapat' => (string) $pointsEarned,
            'total_poin' => (string) $member->total_points,
            'daftar_reward' => $rewardList,
        ]);

        if ($sent) {
            return true;
        }

        // Fallback 1: template "points_earned" — parameter sesuai body template Meta:
        // customer_name, total_belanja, poin_didapat, total_poin
        $sent = WhatsAppNotifier::sendTemplate($member->phone, 'points_earned', [
            'customer_name' => $member->name,
            'total_belanja' => $totalFormatted,
            'poin_didapat' => (string) $pointsEarned,
            'total_poin' => (string) $member->total_points,
        ]);

        if ($sent) {
            return true;
        }

        // Fallback 2: teks bebas (butuh customer service window 24 jam)
        $text = "Halo {$member->name}! Terima kasih sudah berbelanja Rp {$totalFormatted} di {$storeName}. "
            . "Anda mendapat {$pointsEarned} poin dari transaksi ini.\n\n"
            . "Total poin Anda sekarang: *{$member->total_points} poin*.\n\n"
            . "Poin bisa ditukar dengan: {$rewardList}\n\n"
            . "Tukarkan poin Anda di kasir saat transaksi berikutnya. Terima kasih!";

        return WhatsAppNotifier::sendText($member->phone, $text);
    }
}
