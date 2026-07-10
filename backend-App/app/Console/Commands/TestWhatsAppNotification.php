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
        {variables?* : Variabel template berurutan, mis. "Budi" "Toko Kita"}
        {--status : Tampilkan status nomor & template alih-alih mengirim pesan}';

    protected $description = 'Cek status koneksi WhatsApp atau kirim template WhatsApp untuk pengujian';

    public function handle(): int
    {
        if ($this->option('status')) {
            return $this->showStatus();
        }

        $phone = $this->argument('phone');
        $template = $this->argument('template');
        $variables = $this->argument('variables');

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
}
