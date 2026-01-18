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
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Store, Search, Trash2, Edit, MapPin } from 'lucide-react';

interface StoreData {
    id: number;
    name: string;
    location: string | null;
    owner_id: number;
    owner?: { id: number; name: string; email: string };
    users_count?: number;
    created_at: string;
}

export default function StoresManagementPage() {
    const { isAdmin } = useAuth();
    const { toast } = useToast();
    const [stores, setStores] = useState<StoreData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedStore, setSelectedStore] = useState<StoreData | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        location: '',
    });

    useEffect(() => {
        if (isAdmin()) {
            fetchStores();
        } else {
            setLoading(false);
        }
    }, [search, isAdmin]);

    const fetchStores = async () => {
        try {
            setLoading(true);
            const { data } = await api.get('/stores-management', {
                params: { search }
            });
            setStores(data.data);
        } catch (error) {
            console.error('Failed to fetch stores:', error);
            toast({ title: 'Gagal', description: 'Gagal memuat data toko', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStore) return;

        try {
            await api.put(`/stores-management/${selectedStore.id}`, formData);
            toast({ title: 'Berhasil', description: 'Toko berhasil diperbarui' });
            setIsEditOpen(false);
            setSelectedStore(null);
            fetchStores();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Terjadi kesalahan';
            toast({ title: 'Gagal', description: msg, variant: 'destructive' });
        }
    };

    const handleDelete = async (storeId: number) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus toko ini? Tindakan ini tidak dapat dibatalkan.')) return;

        try {
            await api.delete(`/stores-management/${storeId}`);
            toast({ title: 'Berhasil', description: 'Toko berhasil dihapus' });
            fetchStores();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Gagal menghapus toko';
            toast({ title: 'Gagal', description: msg, variant: 'destructive' });
        }
    };

    const openEdit = (store: StoreData) => {
        setSelectedStore(store);
        setFormData({
            name: store.name,
            location: store.location || '',
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
        );
    }

    return (
        <MainLayout>
            <div className="p-8 space-y-8 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-foreground">Manajemen Toko</h1>
                        <p className="text-muted-foreground mt-1">Kelola semua toko dalam sistem</p>
                    </div>
                </div>

                {/* Edit Dialog */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Toko</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nama Toko</Label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Lokasi / Alamat</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={formData.location}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        className="pl-9"
                                        placeholder="Alamat toko"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                                    Batal
                                </Button>
                                <Button type="submit">Update</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari toko..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-card"
                        />
                    </div>
                </div>

                <Card className="card-elevated">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Store className="w-5 h-5 text-primary" />
                            Daftar Toko
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama Toko</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Lokasi</TableHead>
                                    <TableHead>Jumlah User</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                                    </TableRow>
                                ) : stores.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            Tidak ada toko ditemukan
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    stores.map((store) => (
                                        <TableRow key={store.id}>
                                            <TableCell className="font-medium">{store.name}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{store.owner?.name || '-'}</p>
                                                    <p className="text-xs text-muted-foreground">{store.owner?.email}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {store.location || '-'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {store.users_count || 0} user
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => openEdit(store)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(store.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
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
