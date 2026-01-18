import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import {
    Shield,
    Check,
    Save
} from 'lucide-react';
import { toast } from 'sonner';

interface Permission {
    key: string;
    label: string;
    group: string;
}

interface RoleData {
    name: string;
    permissions: string[];
}

export default function RolesPage() {
    const { canEdit } = useAuth();
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Group permissions by group name
    const groupedPermissions = availablePermissions.reduce((acc, perm) => {
        if (!acc[perm.group]) {
            acc[perm.group] = [];
        }
        acc[perm.group].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const response = await api.get('/roles');
            setRoles(response.data.roles);
            setAvailablePermissions(response.data.available_permissions);
        } catch (error) {
            console.error('Failed to fetch roles:', error);
            toast.error('Gagal memuat data role');
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionToggle = (roleName: string, permissionKey: string) => {
        const updatedRoles = roles.map(role => {
            if (role.name !== roleName) return role;

            const hasPermission = role.permissions.includes(permissionKey);
            let newPermissions;

            if (hasPermission) {
                newPermissions = role.permissions.filter(p => p !== permissionKey);
            } else {
                newPermissions = [...role.permissions, permissionKey];
            }

            return { ...role, permissions: newPermissions };
        });

        setRoles(updatedRoles);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save each role's permissions
            const promises = roles.map(role =>
                api.put(`/roles/${role.name}`, { permissions: role.permissions })
            );

            await Promise.all(promises);
            toast.success('Pengaturan role berhasil disimpan');
        } catch (error) {
            console.error('Failed to save roles:', error);
            toast.error('Gagal menyimpan pengaturan');
        } finally {
            setSaving(false);
        }
    };

    if (!canEdit()) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                    <p className="text-xl text-muted-foreground">Akses Ditolak</p>
                </div>
            </MainLayout>
        );
    }

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="p-8 max-w-7xl mx-auto animate-fade-in">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-display font-bold">Role & Permission</h1>
                        <p className="text-muted-foreground mt-1">
                            Atur hak akses untuk setiap role pengguna
                        </p>
                    </div>

                    <button
                        className="btn-primary flex items-center gap-2"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Simpan Perubahan
                    </button>
                </div>

                <div className="card-elevated overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-secondary/50 border-b border-border">
                                    <th className="text-left py-4 px-6 font-semibold w-1/3">Permission</th>
                                    {roles.map(role => (
                                        <th key={role.name} className="text-center py-4 px-6 font-semibold capitalize min-w-[120px]">
                                            <div className={`inline-block px-3 py-1 rounded-full text-sm
                                                ${role.name === 'owner' ? 'bg-primary/10 text-primary' :
                                                    role.name === 'admin' ? 'bg-indigo-500/10 text-indigo-500' :
                                                        'bg-gray-500/10 text-gray-500'}
                                            `}>
                                                {role.name}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {Object.entries(groupedPermissions).map(([group, permissions]) => (
                                    <>
                                        <tr key={group} className="bg-secondary/20">
                                            <td colSpan={roles.length + 1} className="py-2 px-6 font-bold text-sm text-muted-foreground uppercase tracking-wider">
                                                {group}
                                            </td>
                                        </tr>
                                        {permissions.map(perm => (
                                            <tr key={perm.key} className="hover:bg-secondary/10 transition-colors">
                                                <td className="py-3 px-6">
                                                    <div>
                                                        <p className="font-medium text-sm">{perm.label}</p>
                                                        <p className="text-xs text-muted-foreground font-mono mt-0.5 opacity-70">{perm.key}</p>
                                                    </div>
                                                </td>
                                                {roles.map(role => {
                                                    const isChecked = role.permissions.includes(perm.key);

                                                    return (
                                                        <td key={`${role.name}-${perm.key}`} className="text-center py-3 px-6">
                                                            <div className="flex justify-center">
                                                                <label className={`
                                                                    relative flex items-center justify-center w-6 h-6 rounded border-2 cursor-pointer transition-all
                                                                    ${isChecked
                                                                        ? 'bg-primary border-primary text-primary-foreground'
                                                                        : 'bg-transparent border-input hover:border-primary/50'}
                                                                `}>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="absolute opacity-0 w-full h-full cursor-pointer"
                                                                        checked={isChecked}
                                                                        onChange={() => handlePermissionToggle(role.name, perm.key)}
                                                                    />
                                                                    {isChecked && <Check className="w-4 h-4" />}
                                                                </label>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
