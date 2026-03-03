<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class DailyShoppingExport implements FromCollection, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    protected $data;
    protected $date;

    public function __construct($data, $date)
    {
        $this->data = $data;
        $this->date = $date;
    }

    public function collection()
    {
        return $this->data;
    }

    public function map($item): array
    {
        return [
            $item->shopping_date,
            $item->item_name,
            $item->quantity . ' ' . $item->unit,
            $item->price_per_unit,
            $item->total_price,
            $item->status,
            $item->user->name ?? '-',
            $item->notes,
        ];
    }

    public function headings(): array
    {
        return [
            ['Laporan Belanja Harian'],
            ['Tanggal: ' . $this->date],
            [],
            [
                'Tanggal Belanja',
                'Nama Barang',
                'Jumlah',
                'Harga Satuan',
                'Total Harga',
                'Status',
                'Dibelikan Oleh',
                'Catatan',
            ]
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            // Title
            1 => ['font' => ['bold' => true, 'size' => 16]],
            2 => ['font' => ['bold' => true, 'size' => 12]],
            
            // Header Row
            4 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '4B5563']],
            ],
        ];
    }
}
