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
     *
     * Provider dipilih lewat WHATSAPP_PROVIDER di .env:
     *  - "meta"    : kirim langsung ke Meta WhatsApp Cloud API (graph.facebook.com)
     *  - "gateway" : kirim lewat gateway pihak ketiga (chat.api.co.id)
     */
    public static function sendTemplate(string $phone, string $templateName, array $variables): bool
    {
        if (config('services.whatsapp.provider') === 'meta') {
            return self::sendViaMeta($phone, $templateName, $variables);
        }

        return self::sendViaGateway($phone, $templateName, $variables);
    }

    /**
     * Kirim pesan teks bebas (tanpa template). Hanya berhasil jika pelanggan
     * mengirim pesan lebih dulu dalam 24 jam terakhir (customer service window).
     * Khusus provider "meta".
     */
    public static function sendText(string $phone, string $message): bool
    {
        if (config('services.whatsapp.provider') !== 'meta') {
            Log::warning('WhatsApp sendText hanya didukung provider meta');
            return false;
        }

        $graphUrl = rtrim(config('services.whatsapp.meta.graph_url'), '/');
        $accessToken = config('services.whatsapp.meta.access_token');
        $phoneNumberId = config('services.whatsapp.meta.phone_number_id');

        if (!$accessToken || !$phoneNumberId) {
            return false;
        }

        try {
            $response = Http::withToken($accessToken)
                ->timeout(10)
                ->post("{$graphUrl}/{$phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'to' => self::normalizePhone($phone),
                    'type' => 'text',
                    'text' => ['body' => $message],
                ]);

            if (!$response->successful()) {
                Log::warning('WhatsApp (Meta) text failed', [
                    'phone' => $phone,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('WhatsApp (Meta) text error: ' . $e->getMessage());
            return false;
        }
    }

    private static function sendViaMeta(string $phone, string $templateName, array $variables): bool
    {
        $graphUrl = rtrim(config('services.whatsapp.meta.graph_url'), '/');
        $accessToken = config('services.whatsapp.meta.access_token');
        $phoneNumberId = config('services.whatsapp.meta.phone_number_id');

        if (!$accessToken || !$phoneNumberId) {
            Log::warning('WhatsApp (Meta) belum dikonfigurasi: WHATSAPP_META_ACCESS_TOKEN / WHATSAPP_META_PHONE_NUMBER_ID kosong');
            return false;
        }

        $template = [
            'name' => $templateName,
            'language' => ['code' => 'id'],
        ];

        if ($variables !== []) {
            // Key string = template dengan parameter bernama ({{customer_name}}),
            // key numerik = parameter posisi ({{1}}, {{2}}, ...)
            $isNamed = array_keys($variables) !== range(0, count($variables) - 1);

            $parameters = [];
            foreach ($variables as $key => $value) {
                $param = ['type' => 'text', 'text' => (string) $value];
                if ($isNamed) {
                    $param['parameter_name'] = (string) $key;
                }
                $parameters[] = $param;
            }

            $template['components'] = [
                [
                    'type' => 'body',
                    'parameters' => $parameters,
                ],
            ];
        }

        try {
            $response = Http::withToken($accessToken)
                ->timeout(10)
                ->post("{$graphUrl}/{$phoneNumberId}/messages", [
                    'messaging_product' => 'whatsapp',
                    'to' => self::normalizePhone($phone),
                    'type' => 'template',
                    'template' => $template,
                ]);

            if (!$response->successful()) {
                Log::warning('WhatsApp (Meta) notification failed', [
                    'phone' => $phone,
                    'template' => $templateName,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('WhatsApp (Meta) notification error: ' . $e->getMessage());
            return false;
        }
    }

    private static function sendViaGateway(string $phone, string $templateName, array $variables): bool
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
