<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

class PruneAuditLogs extends Command
{
    protected $signature = 'audit-logs:prune {--days=90 : Hapus audit log lebih lama dari N hari}';

    protected $description = 'Hapus audit log yang lebih lama dari periode retensi';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $cutoff = now()->subDays($days);

        $deleted = AuditLog::where('created_at', '<', $cutoff)->delete();

        $this->info("Terhapus {$deleted} audit log lebih lama dari {$cutoff->toDateString()}.");

        return self::SUCCESS;
    }
}
