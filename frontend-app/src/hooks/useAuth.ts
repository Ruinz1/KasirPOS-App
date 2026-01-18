import { useState, useEffect, useCallback } from 'react';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'owner' | 'karyawan';
    permissions: string[];
    positions?: string[];
    salary_type?: 'auto' | 'manual';
    base_salary?: number;
    bonus?: number;
    store_id?: number | null;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ... (effect remains same)
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const parsed = JSON.parse(userData);
                setUser(parsed);
            }
        } catch (e) {
            console.error('Failed to parse user data:', e);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        } finally {
            setLoading(false);
        }
    }, []);

    const isOwner = useCallback(() => user?.role === 'owner', [user]);
    const isAdmin = useCallback(() => user?.role === 'admin', [user]);
    const isKaryawan = useCallback(() => user?.role === 'karyawan', [user]);
    const canEdit = useCallback(() => user?.role === 'admin' || user?.role === 'owner', [user]);

    const hasPermission = useCallback((permission: string) => {
        if (!user) return false;
        // Owner default has universal access if needed, checking role
        if (user.role === 'owner') return true;
        // Safety check for permissions array
        return Array.isArray(user.permissions) && user.permissions.includes(permission);
    }, [user]);

    return {
        user,
        loading,
        isOwner,
        isAdmin,
        isKaryawan,
        canEdit,
        hasPermission,
    };
}
