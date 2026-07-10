<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppNotifier
{
    /**
     * Send a WhatsApp notification using an approved message template.
     * Free-form text messages require the customer to have messaged first,
     * so all outbound notifications must go through a Meta-approved template.
     */
    public static function sendTemplate(string $phone, string $templateName, array $variables): bool
    {
        $baseUrl = config('services.whatsapp.base_url');
        $apiKey = config('services.whatsapp.api_key');
        $phoneNumberId = config('services.whatsapp.phone_number_id');

        if (!$baseUrl || !$apiKey || !$phoneNumberId) {
            return false;
        }

        try {
            $response = Http::withToken($apiKey)
                ->timeout(5)
                ->post(rtrim($baseUrl, '/') . '/api/v1/public/messages/send', [
                    'phone_number' => self::normalizePhone($phone),
                    'channel' => 'whatsapp',
                    'message_type' => 'template',
                    'whatsapp_phone_number_id' => $phoneNumberId,
                    'template' => [
                        'name' => $templateName,
                        'language' => ['code' => 'id'],
                        'components' => [
                            [
                                'type' => 'body',
                                'parameters' => array_map(
                                    fn ($value) => ['type' => 'text', 'text' => (string) $value],
                                    $variables
                                ),
                            ],
                        ],
                    ],
                ]);

            if (!$response->successful()) {
                Log::warning('WhatsApp notification failed', [
                    'phone' => $phone,
                    'template' => $templateName,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('WhatsApp notification error: ' . $e->getMessage());
            return false;
        }
    }

    private static function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone);

        if (str_starts_with($digits, '0')) {
            return '62' . substr($digits, 1);
        }

        if (!str_starts_with($digits, '62')) {
            return '62' . $digits;
        }

        return $digits;
    }
}
