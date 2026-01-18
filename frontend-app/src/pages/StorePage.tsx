import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Store as StoreIcon, MapPin, Users, Save } from 'lucide-react';

interface StoreData {
    id: number;
    name: string;
    location: string | null;
    users_count?: number;
    owner?: { id: number; name: string; email: string };
}

import { MainLayout } from '@/components/layout/MainLayout';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function StorePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({ name: '', location: '' });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Access Control
    useEffect(() => {
        if (user && user.role !== 'owner') {
            toast({
                title: "Akses Ditolak",
                description: "Hanya Owner yang dapat mengakses halaman ini",
                variant: "destructive"
            });
            navigate('/');
        }
    }, [user, navigate]);

    // Data Fetching with Cache
    const { data: store, isLoading: loading } = useQuery({
        queryKey: ['store'],
        queryFn: async () => {
            const { data } = await api.get('/store');
            return data;
        },
        retry: false,
        staleTime: 1000 * 60 * 5, // 5 mins
    });

    // Sync form data when store data is loaded
    useEffect(() => {
        if (store) {
            setFormData({ name: store.name, location: store.location || '' });
            if (store.image) {
                setPreviewUrl(`http://127.0.0.1:8000/storage/${store.image}`);
            }
        }
    }, [store]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Mutations for Create/Update
    const mutation = useMutation({
        mutationFn: async (vars: { id?: number, formData: FormData }) => {
            if (vars.id) {
                // Update - Use POST with _method=PUT to handle file upload
                vars.formData.append('_method', 'PUT');
                return api.post('/store', vars.formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            } else {
                // Create
                return api.post('/store', vars.formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
        },
        onSuccess: (res, vars) => {
            queryClient.invalidateQueries({ queryKey: ['store'] });

            if (!vars.id) {
                // If created new store, update local user storage manually 
                // (Ideally useAuth should handle this via a refreshUser function)
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const updatedUser = JSON.parse(storedUser);
                    updatedUser.store_id = res.data.id;
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                }
                // Reload entirely to ensure all contexts (Sidebar etc) pick it up if not using query
                window.location.reload();
            } else {
                toast({ title: 'Berhasil', description: 'Profil toko diperbarui' });
            }
        },
        onError: (error: any) => {
            console.error('Store Error:', error);
            const msg = error.response?.data?.message || 'Terjadi kesalahan saat menyimpan data toko';
            toast({ title: 'Gagal', description: msg, variant: 'destructive' });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const data = new FormData();
        data.append('name', formData.name);
        data.append('location', formData.location);
        if (imageFile) {
            data.append('image', imageFile);
        }

        mutation.mutate({ id: store?.id, formData: data });
    };

    if (loading) return <div className="p-8">Loading...</div>;

    const content = (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">Profil Toko</h1>
                    <p className="text-muted-foreground mt-1">Kelola informasi toko dan cabang Anda</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="card-elevated md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <StoreIcon className="w-5 h-5 text-primary" />
                            {store ? 'Informasi Toko' : 'Buat Toko Baru'}
                        </CardTitle>
                        <CardDescription>
                            {store ? 'Edit detail toko Anda di bawah ini' : 'Silakan isi data untuk membuat toko pertama Anda'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-4">
                                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg border-muted-foreground/25 hover:border-primary/50 transition-colors">
                                    <div className="relative group cursor-pointer">
                                        <div className="w-24 h-24 rounded-full overflow-hidden bg-secondary mb-3 relative">
                                            {previewUrl ? (
                                                <img src={previewUrl} alt="Store Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <StoreIcon className="w-12 h-12 text-muted-foreground absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                                            )}
                                        </div>
                                        <Label htmlFor="image-upload" className="cursor-pointer text-sm font-medium text-primary hover:underline">
                                            {previewUrl ? 'Ganti Logo' : 'Upload Logo'}
                                        </Label>
                                        <Input
                                            id="image-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">Format: JPG, PNG (Max 2MB)</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Owner Toko</Label>
                                <Input
                                    value={store?.owner?.name || user?.name || '-'}
                                    disabled
                                    className="input-coffee bg-secondary/50 font-medium text-foreground"
                                />
                                <p className="text-xs text-muted-foreground">Owner tidak dapat diubah</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Toko</Label>
                                <Input
                                    id="name"
                                    placeholder="Contoh: Kopi Nusantara - Cabang Pusat"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="input-coffee"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="location">Lokasi / Alamat</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="location"
                                        placeholder="Alamat lengkap toko"
                                        value={formData.location}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        className="input-coffee pl-9"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <Button type="submit" className="btn-primary">
                                    <Save className="w-4 h-4 mr-2" />
                                    {store ? 'Simpan Perubahan' : 'Buat Toko'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {store && (
                    <Card className="stat-card bg-secondary/20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Users className="w-4 h-4" /> Total Karyawan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold font-display text-primary">
                                {store.users_count || 1}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">Termasuk Owner</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );

    if (store) {
        return <MainLayout>{content}</MainLayout>;
    }

    return (
        <div className="min-h-screen bg-background flex flex-col justify-center items-center">
            <div className="w-full max-w-4xl">
                {content}
            </div>
        </div>
    );
}
