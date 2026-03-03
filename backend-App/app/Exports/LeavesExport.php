<?php

namespace App\Exports;

use App\Models\Leave;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class LeavesExport implements FromCollection, WithHeadings, WithMapping, WithStyles, ShouldAutoSize
{
    protected $data;

    public function __construct($data)
    {
        $this->data = $data;
    }

    public function collection()
    {
        return $this->data;
    }

    public function headings(): array
    {
        return [
            'ID',
            'Nama Karyawan',
            'Role',
            'Tanggal Mulai',
            'Tanggal Selesai',
            'Lama Cuti (Hari)',
            'Alasan',
            'Status',
            'Disetujui Oleh',
            'Tanggal Pengajuan',
        ];
    }

    public function map($leave): array
    {
        $duration = $leave->start_date->diffInDays($leave->end_date) + 1;
        
        return [
            $leave->id,
            $leave->user->name,
            $leave->user->role,
            $leave->start_date->format('d/m/Y'),
            $leave->end_date->format('d/m/Y'),
            $duration,
            $leave->reason,
            ucfirst($leave->status),
            $leave->approver ? $leave->approver->name : '-',
            $leave->created_at->format('d/m/Y H:i'),
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            // Style the first row as bold text.
            1    => ['font' => ['bold' => true]],
        ];
    }
}
