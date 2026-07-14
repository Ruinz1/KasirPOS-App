<?php

namespace App\Console\Commands;

use App\Services\WhatsAppNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestWhatsAppNotification extends Command
{
    protected $signature = 'whatsapp:test
        {phone : Nomor tujuan, mis. 082193734482}
        {template=member_welcome : Nama template}
        {variables?* : Variabel template, posisi ("Budi") atau bernama (customer_name=Budi)}
        {--status : Tampilkan status nomor & template alih-alih mengirim pesan}
        {--text= : Kirim pesan teks bebas (butuh pelanggan chat duluan <24 jam)}';

    protected $description = 'Cek status koneksi WhatsApp atau kirim template WhatsApp untuk pengujian';

    public function handle(): int
    {
        if ($this->option('status')) {
            return $this->showStatus();
        }

        $phone = $this->argument('phone');

        if ($text = $this->option('text')) {
            $this->info("Mengirim pesan teks ke {$phone}...");
            $ok = WhatsAppNotifier::sendText($phone, $text);

            if ($ok) {
                $this->info('Berhasil terkirim.');
                return self::SUCCESS;
            }

            $this->error('Gagal. Pastikan nomor tujuan sudah chat duluan ke nomor bisnis dalam 24 jam terakhir. Detail: storage/logs/laravel.log');
            return self::FAILURE;
        }

        $template = $this->argument('template');

        // "kunci=nilai" jadi parameter bernama, selain itu parameter posisi
        $variables = [];
        foreach ($this->argument('variables') as $raw) {
            if (str_contains($raw, '=')) {
                [$key, $value] = explode('=', $raw, 2);
                $variables[$key] = $value;
            } else {
                $variables[] = $raw;
            }
        }

        $this->info("Mengirim template \"{$template}\" ke {$phone}...");

        $ok = WhatsAppNotifier::sendTemplate($phone, $template, $variables);

        if ($ok) {
            $this->info('Berhasil terkirim.');
            return self::SUCCESS;
        }

        $this->error('Gagal terkirim. Lihat storage/logs/laravel.log untuk detail error dari provider.');
        return self::FAILURE;
    }

    private function showStatus(): int
    {
        if (config('services.whatsapp.provider') === 'meta') {
            return $this->showMetaStatus();
        }

        $baseUrl = rtrim(config('services.whatsapp.base_url'), '/');
        $apiKey = config('services.whatsapp.api_key');

        if (!$baseUrl || !$apiKey) {
            $this->error('WHATSAPP_API_BASE_URL / WHATSAPP_API_KEY belum diset di .env');
            return self::FAILURE;
        }

        $phoneRes = Http::withToken($apiKey)->get($baseUrl . '/api/v1/public/phone-numbers');
        $this->line('== Nomor terhubung ==');
        foreach ($phoneRes->json('data', []) as $p) {
            $this->line("- {$p['display_phone_number']} | id: {$p['id']} | status: {$p['connection_status']}");
        }

        $templateRes = Http::withToken($apiKey)->get($baseUrl . '/api/v1/public/templates');
        $this->line('');
        $this->line('== Template ==');
        foreach ($templateRes->json('data', []) as $t) {
            $this->line("- {$t['template_name']} ({$t['category']}) | status: {$t['status']}");
        }

        return self::SUCCESS;
    }

    private function showMetaStatus(): int
    {
        $graphUrl = rtrim(config('services.whatsapp.meta.graph_url'), '/');
        $accessToken = config('services.whatsapp.meta.access_token');
        $phoneNumberId = config('services.whatsapp.meta.phone_number_id');
        $wabaId = config('services.whatsapp.meta.business_account_id');

        if (!$accessToken || !$phoneNumberId) {
            $this->error('WHATSAPP_META_ACCESS_TOKEN / WHATSAPP_META_PHONE_NUMBER_ID belum diset di .env');
            return self::FAILURE;
        }

        $phoneRes = Http::withToken($accessToken)->get("{$graphUrl}/{$phoneNumberId}", [
            'fields' => 'display_phone_number,verified_name,quality_rating',
        ]);

        $this->line('== Nomor terhubung (Meta Cloud API) ==');
        if ($phoneRes->successful()) {
            $p = $phoneRes->json();
            $this->line("- {$p['display_phone_number']} | nama: {$p['verified_name']} | kualitas: {$p['quality_rating']}");
        } else {
            $this->error('Gagal ambil info nomor: ' . $phoneRes->body());
        }

        if (!$wabaId) {
            $this->line('');
            $this->line('Set WHATSAPP_META_WABA_ID untuk menampilkan daftar template.');
            return self::SUCCESS;
        }

        $templateRes = Http::withToken($accessToken)->get("{$graphUrl}/{$wabaId}/message_templates", [
            'fields' => 'name,status,category,language',
            'limit' => 100,
        ]);

        $this->line('');
        $this->line('== Template ==');
        if ($templateRes->successful()) {
            foreach ($templateRes->json('data', []) as $t) {
                $this->line("- {$t['name']} ({$t['category']}, {$t['language']}) | status: {$t['status']}");
            }
        } else {
            $this->error('Gagal ambil template: ' . $templateRes->body());
        }

        return self::SUCCESS;
    }
}
