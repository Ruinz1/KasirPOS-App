<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ParkingTicket extends Model
{
    use HasFactory;

    protected $fillable = [
        'ticket_number',
        'store_id',
        'vehicle_type',
        'fee',
        'status',
        'checked_in_by',
        'checked_out_by',
        'checked_out_at',
    ];

    protected $casts = [
        'fee' => 'integer',
        'checked_out_at' => 'datetime',
    ];

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function checkedInBy()
    {
        return $this->belongsTo(User::class, 'checked_in_by');
    }

    public function checkedOutBy()
    {
        return $this->belongsTo(User::class, 'checked_out_by');
    }
}
