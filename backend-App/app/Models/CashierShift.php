<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

use App\Traits\BelongsToStore;

class CashierShift extends Model
{
    use BelongsToStore;

    protected $fillable = [
        'user_id',
        'store_id',
        'opened_at',
        'closed_at',
        'opening_cash',
        'closing_cash',
        'expected_cash',
        'cash_sales',
        'cash_change',
        'qris_sales',
        'card_sales',
        'discrepancy',
        'total_transactions',
        'total_revenue',
        'notes_open',
        'notes_close',
        'adjustments',
        'status',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
        'opening_cash' => 'decimal:2',
        'closing_cash' => 'decimal:2',
        'expected_cash' => 'decimal:2',
        'cash_sales' => 'decimal:2',
        'cash_change' => 'decimal:2',
        'qris_sales' => 'decimal:2',
        'card_sales' => 'decimal:2',
        'discrepancy' => 'decimal:2',
        'total_revenue' => 'decimal:2',
        'adjustments' => 'array',
    ];

    /**
     * Get the user (kasir) who owns this shift
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the daily shopping records associated with this shift
     */
    public function dailyShoppings(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(DailyShopping::class);
    }

    /**
     * Scope: only open shifts
     */
    public function scopeOpen($query)
    {
        return $query->where('status', 'open');
    }

    /**
     * Scope: only closed shifts
     */
    public function scopeClosed($query)
    {
        return $query->where('status', 'closed');
    }

    /**
     * Calculate shift data from orders made during this shift period.
     * This considers orders by the same user, same store, between opened_at and now/closed_at.
     */
    public function calculateShiftData(): array
    {
        $endTime = $this->closed_at ?? now();

        // Get all completed orders during this shift, by this user, in this store
        $orders = Order::withoutGlobalScope('store')
            ->where('store_id', $this->store_id)
            ->where('user_id', $this->user_id)
            ->where('status', 'completed')
            ->where('created_at', '>=', $this->opened_at)
            ->where('created_at', '<=', $endTime)
            ->get();

        $totalTransactions = $orders->count();
        $totalRevenue = $orders->sum('total');

        // Cash sales: orders paid with cash (primary payment method)
        $cashOrders = $orders->where('payment_method', 'cash');
        $cashSales = $cashOrders->sum('total');

        // Also include cash portion from split payments (second_payment_method = cash)
        $splitCashOrders = $orders->where('second_payment_method', 'cash');
        $splitCashSales = $splitCashOrders->sum('second_paid_amount');
        $cashSales += $splitCashSales;

        // Cash change: kembalian dari pembayaran cash
        $cashChange = $cashOrders->sum('change_amount');

        // QRIS sales
        $qrisSales = $orders->where('payment_method', 'qris')->sum('total');
        $splitQrisSales = $orders->where('second_payment_method', 'qris')->sum('second_paid_amount');
        $qrisSales += $splitQrisSales;

        // Card sales
        $cardSales = $orders->where('payment_method', 'card')->sum('total');
        $splitCardSales = $orders->where('second_payment_method', 'card')->sum('second_paid_amount');
        $cardSales += $splitCardSales;

        // Paylater sales (payment_method is null or payment_status is pending)
        $paylaterSales = $orders->whereNull('payment_method')->sum('total');

        // Daily Shopping (belanja) expenses associated with this shift
        $shoppingExpenses = DailyShopping::where('cashier_shift_id', $this->id)
            ->orWhere(function ($query) use ($endTime) {
                $query->whereNull('cashier_shift_id')
                    ->where('store_id', $this->store_id)
                    ->where('user_id', $this->user_id)
                    ->where('created_at', '>=', $this->opened_at)
                    ->where('created_at', '<=', $endTime);
            })
            ->sum('total_price');

        // Expected cash = opening + cash received - change given - shopping expenses
        $expectedCash = $this->opening_cash + $cashSales - $cashChange - $shoppingExpenses;

        return [
            'total_transactions' => $totalTransactions,
            'total_revenue' => $totalRevenue,
            'cash_sales' => $cashSales,
            'cash_change' => $cashChange,
            'qris_sales' => $qrisSales,
            'card_sales' => $cardSales,
            'paylater_sales' => $paylaterSales,
            'shopping_expenses' => $shoppingExpenses,
            'expected_cash' => $expectedCash,
        ];
    }
}
