<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

use App\Traits\BelongsToStore;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, BelongsToStore;
    
    /**
     * Get the store owned by the user.
     */
    public function ownedStore()
    {
        return $this->hasOne(Store::class, 'owner_id');
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'positions',
        'salary_type',
        'base_salary',
        'bonus',
        'store_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'positions' => 'array',
            'base_salary' => 'decimal:2',
            'bonus' => 'decimal:2',
        ];
    }

    /**
     * Get orders created by this user (kasir)
     */
    public function orders()
    {
        return $this->hasMany(\App\Models\Order::class);
    }

    /**
     * Get capital records created by this user (owner)
     */
    public function capitalRecords()
    {
        return $this->hasMany(\App\Models\CapitalRecord::class);
    }

    /**
     * Calculate monthly salary based on salary type
     */
    public function calculateMonthlySalary(?int $month = null, ?int $year = null): float
    {
        if ($this->salary_type === 'manual') {
            return $this->base_salary + $this->bonus;
        }

        // Auto calculation: 50,000 × calendar days in month
        $month = $month ?? now()->month;
        $year = $year ?? now()->year;
        $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
        
        return ($daysInMonth * 50000) + $this->bonus;
    }

    /**
     * Check if user is owner
     */
    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    /**
     * Check if user is admin
     */
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    /**
     * Check if user is kasir
     */
    public function isKasir(): bool
    {
        return $this->role === 'kasir';
    }

    /**
     * Check if user can edit (admin or owner)
     */
    public function canEdit(): bool
    {
        return in_array($this->role, ['admin', 'owner']);
    }

    /**
     * The accessors to append to the model's array form.
     * 
     * @var array
     */
    protected $appends = ['permissions'];

    /**
     * Get all permissions for the user's role
     */
    public function getPermissionsAttribute()
    {
        // If owner, give all permissions hardcoded as a fail-safe, or rely on DB?
        // Let's rely on DB but ensure we seed/configure Owner properly. 
        // Or for now, query the role_permissions table.
        return \App\Models\RolePermission::where('role', $this->role)
            ->pluck('permission')
            ->toArray();
    }
    /**
     * Check if user has a specific permission
     */
    public function hasPermission(string $permission): bool
    {
        // Owner has full access
        if ($this->isOwner()) {
            return true;
        }

        return in_array($permission, $this->permissions);
    }

    /**
     * Check if user has a specific position
     */
    public function hasPosition(string $position): bool
    {
        if (!is_array($this->positions)) {
            return false;
        }

        return in_array($position, $this->positions);
    }
}
