<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ParkingTicket;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ParkingTicketController extends Controller
{
    /**
     * Daftar karcis parkir (default: yang masih aktif/belum keluar).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = ParkingTicket::query();

        if ($request->has('store_id') && $user->role === 'admin') {
            $query->where('store_id', $request->store_id);
        } elseif ($user->store_id) {
            $query->where('store_id', $user->store_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        } else {
            $query->where('status', 'active');
        }

        $tickets = $query->orderBy('created_at', 'desc')->get();

        return response()->json($tickets);
    }

    /**
     * Cetak karcis parkir baru (kendaraan masuk).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'vehicle_type' => 'required|in:motor,mobil',
        ]);

        $user = $request->user();
        $storeId = $user->store_id;

        if (!$storeId) {
            return response()->json(['message' => 'Toko belum dikonfigurasi'], 404);
        }

        $store = Store::findOrFail($storeId);
        $fee = $store->parkingFeeFor($validated['vehicle_type']);

        DB::beginTransaction();
        try {
            // Nomor urut karcis reset tiap hari per toko
            $todayCount = ParkingTicket::where('store_id', $storeId)
                ->whereDate('created_at', now()->toDateString())
                ->lockForUpdate()
                ->count();

            $checkoutEnabled = $store->parking_checkout_enabled ?? true;

            $ticket = ParkingTicket::create([
                'ticket_number' => str_pad((string)($todayCount + 1), 4, '0', STR_PAD_LEFT),
                'store_id' => $storeId,
                'vehicle_type' => $validated['vehicle_type'],
                'fee' => $fee,
                // Jika toko tidak memakai proses jam keluar, karcis langsung selesai saat dicetak
                'status' => $checkoutEnabled ? 'active' : 'checked_out',
                'checked_in_by' => $user->id,
                'checked_out_by' => $checkoutEnabled ? null : $user->id,
                'checked_out_at' => $checkoutEnabled ? null : now(),
            ]);

            DB::commit();

            $ticket->load('checkedInBy');
            return response()->json($ticket, 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal membuat karcis parkir',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Kendaraan keluar / karcis dibayar & selesai.
     */
    public function checkout(Request $request, ParkingTicket $parkingTicket)
    {
        if ($parkingTicket->status === 'checked_out') {
            return response()->json(['message' => 'Karcis ini sudah diselesaikan'], 422);
        }

        $parkingTicket->status = 'checked_out';
        $parkingTicket->checked_out_by = $request->user()->id;
        $parkingTicket->checked_out_at = now();
        $parkingTicket->save();

        return response()->json($parkingTicket);
    }

    /**
     * Statistik parkir harian (jumlah tiket & total pendapatan).
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = ParkingTicket::query();

        if ($request->has('store_id') && $user->role === 'admin') {
            $query->where('store_id', $request->store_id);
        } elseif ($user->store_id) {
            $query->where('store_id', $user->store_id);
        }

        $date = $request->get('date', now()->toDateString());
        $query->whereDate('created_at', $date);

        $tickets = $query->get();

        return response()->json([
            'date' => $date,
            'total_tickets' => $tickets->count(),
            'total_motor' => $tickets->where('vehicle_type', 'motor')->count(),
            'total_mobil' => $tickets->where('vehicle_type', 'mobil')->count(),
            'total_revenue' => $tickets->where('status', 'checked_out')->sum('fee'),
            'active_now' => $tickets->where('status', 'active')->count(),
        ]);
    }
}
