import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Search, Trash2, Edit } from 'lucide-react';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'owner' | 'karyawan';
    store_id: number | null;
    created_at: string;
}

export default function UsersPage() {
    const { user: authUser, canEdit, isAdmin } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'owner',
    });

    useEffect(() => {
        if (isAdmin()) {
            fetchUsers();
        } else {
            setLoading(false);
        }
    }, [search, isAdmin]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/users', {
                params: { search }
            });
            setUsers(data.data); // Paginated response
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast({ title: 'Gagal', description: 'Gagal memuat data user', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (selectedUser) {
                // Edit
                const updateData: any = { ...formData };
                if (!updateData.password) delete updateData.password; // Don't send empty password

                await api.put(`/users/${selectedUser.id}`, updateData);
                toast({ title: 'Berhasil', description: 'User berhasil diperbarui' });
                setIsEditOpen(false);
            } else {
                // Create
                await api.post('/users', formData);
                toast({ title: 'Berhasil', description: 'User berhasil ditambahkan' });
                setIsAddOpen(false);
            }

            setFormData({ name: '', email: '', password: '', role: 'owner' });
            setSelectedUser(null);
            fetchUsers();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Terjadi kesalahan';
            toast({ title: 'Gagal', description: msg, variant: 'destructive' });
        }
    };

    const handleDelete = async (userId: number) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus user ini?')) return;

        try {
            await api.delete(`/users/${userId}`);
            toast({ title: 'Berhasil', description: 'User berhasil dihapus' });
            fetchUsers();
        } catch (error) {
            toast({ title: 'Gagal', description: 'Gagal menghapus user', variant: 'destructive' });
        }
    };

    const openEdit = (user: User) => {
        setSelectedUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: '', // Empty for edit
            role: user.role
        });
        setIsEditOpen(true);
    };

    if (!isAdmin()) {
        return (
            <MainLayout>
                <div className="p-8 text-center text-muted-foreground">
                    Anda tidak memiliki akses ke halaman ini.
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="p-8 space-y-8 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground">Manajemen User Sistem</h1>
                        <p className="text-muted-foreground mt-1">Kelola Akun Owner, Admin, dan lainnya</p>
                    </div>

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="btn-primary" onClick={() => { setSelectedUser(null); setFormData({ name: '', email: '', password: '', role: 'owner' }); }}>
                                <Plus className="w-4 h-4 mr-2" />
                                Tambah User
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Tambah User Baru</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nama Lengkap</Label>
                                    <Input
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Nama user"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        required
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password</Label>
                                    <Input
                                        required
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="******"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select
                                        value={formData.role}
                                        onValueChange={(val: any) => setFormData({ ...formData, role: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="owner">Owner (Pemilik Toko)</SelectItem>
                                            <SelectItem value="admin">System Admin</SelectItem>
                                            <SelectItem value="karyawan">Karyawan / Staff</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Role 'Owner' akan diminta membuat toko saat login pertama.
                                    </p>
                                </div>
                                <div className="pt-4 flex justify-end">
                                    <Button type="submit">Simpan</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Edit Dialog */}
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Edit User</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Nama Lengkap</Label>
                                    <Input
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input
                                        required
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Password (Kosongkan jika tidak ubah)</Label>
                                    <Input
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="******"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select
                                        value={formData.role}
                                        onValueChange={(val: any) => setFormData({ ...formData, role: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="owner">Owner</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="karyawan">Karyawan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="pt-4 flex justify-end">
                                    <Button type="submit">Update</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari user..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-card"
                        />
                    </div>
                </div>

                <Card className="card-elevated">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Daftar User
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status Toko</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                                    </TableRow>
                                ) : users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Tidak ada user ditemukan</TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((u) => (
                                        <TableRow key={u.id}>
                                            <TableCell className="font-medium">{u.name}</TableCell>
                                            <TableCell>{u.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={u.role === 'admin' ? 'default' : u.role === 'owner' ? 'secondary' : 'outline'}>
                                                    {u.role.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {u.store_id ? (
                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Has Store</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    {authUser?.id !== u.id && (
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(u.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
