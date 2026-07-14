<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuditLogger
{
    /**
     * Catat aksi sensitif ke tabel audit_logs.
     * Tidak boleh menggagalkan request utama — error dicatat ke log saja.
     */
    public static function log(
        Request $request,
        string $action,
        string $description,
        ?string $entityType = null,
        ?int $entityId = null,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?int $storeId = null,
    ): void {
        try {
            $user = $request->user();

            AuditLog::create([
                'store_id' => $storeId ?? $user?->store_id,
                'user_id' => $user?->id,
                'user_name' => $user?->name,
                'user_role' => $user?->role,
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'description' => mb_substr($description, 0, 500),
                'old_values' => $oldValues,
                'new_values' => $newValues,
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('AuditLogger gagal mencatat: ' . $e->getMessage());
        }
    }
}
