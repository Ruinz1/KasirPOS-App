import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { storageUrl } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Store as StoreIcon, MapPin, Users, Save, Navigation, Crosshair, Truck, Info, Car, ClipboardList, Target } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';

interface StoreData {
    id: number;
    name: string;
    location: string | null;
    latitude?: number | null;
    longitude?: number | null;
    delivery_base_fee?: number;
    delivery_fee_per_km?: number;
    delivery_max_km?: number | null;
    parking_fee_motor?: number;
    parking_fee_mobil?: number;
    queue_enabled?: boolean;
    parking_checkout_enabled?: boolean;
    daily_target?: number;
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

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        latitude: '',
        longitude: '',
        delivery_base_fee: '0',
        delivery_fee_per_km: '2000',
        delivery_max_km: '',
        parking_fee_motor: '2000',
        parking_fee_mobil: '3000',
        daily_target: '0',
    });
    const [queueEnabled, setQueueEnabled] = useState(true);
    const [parkingCheckoutEnabled, setParkingCheckoutEnabled] = useState(true);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [gettingLocation, setGettingLocation] = useState(false);

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
            setFormData({
                name: store.name,
                location: store.location || '',
                latitude: store.latitude != null ? String(store.latitude) : '',
                longitude: store.longitude != null ? String(store.longitude) : '',
                delivery_base_fee: String(store.delivery_base_fee ?? 0),
                delivery_fee_per_km: String(store.delivery_fee_per_km ?? 2000),
                delivery_max_km: store.delivery_max_km != null ? String(store.delivery_max_km) : '',
                parking_fee_motor: String(store.parking_fee_motor ?? 2000),
                parking_fee_mobil: String(store.parking_fee_mobil ?? 3000),
                daily_target: String(store.daily_target ?? 0),
            });
            setQueueEnabled(store.queue_enabled ?? true);
            setParkingCheckoutEnabled(store.parking_checkout_enabled ?? true);
            if (store.image) {
                setPreviewUrl(storageUrl(store.image));
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

    // Gunakan lokasi browser sebagai koordinat toko
    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            toast({ title: 'Browser tidak mendukung geolocation', variant: 'destructive' });
            return;
        }
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: String(pos.coords.latitude),
                    longitude: String(pos.coords.longitude),
                }));
                setGettingLocation(false);
                toast({ title: 'Lokasi berhasil didapat', description: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` });
            },
            (err) => {
                setGettingLocation(false);
                toast({ title: 'Gagal mendapat lokasi', description: err.message, variant: 'destructive' });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
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
        if (formData.latitude) data.append('latitude', formData.latitude);
        if (formData.longitude) data.append('longitude', formData.longitude);
        data.append('delivery_base_fee', formData.delivery_base_fee || '0');
        data.append('delivery_fee_per_km', formData.delivery_fee_per_km || '2000');
        if (formData.delivery_max_km) data.append('delivery_max_km', formData.delivery_max_km);
        data.append('parking_fee_motor', formData.parking_fee_motor || '2000');
        data.append('parking_fee_mobil', formData.parking_fee_mobil || '3000');
        data.append('queue_enabled', queueEnabled ? '1' : '0');
        data.append('parking_checkout_enabled', parkingCheckoutEnabled ? '1' : '0');
        data.append('daily_target', formData.daily_target || '0');
        if (imageFile) {
            data.append('image', imageFile);
        }

        mutation.mutate({ id: store?.id, formData: data });
    };

    if (loading) return <div className="p-8">Loading...</div>;

    // OpenStreetMap embed for store location preview
    const storeLat = parseFloat(formData.latitude);
    const storeLng = parseFloat(formData.longitude);
    const storeMapUrl = (!isNaN(storeLat) && !isNaN(storeLng))
        ? `https://www.openstreetmap.org/export/embed.html?bbox=${storeLng - 0.01},${storeLat - 0.01},${storeLng + 0.01},${storeLat + 0.01}&layer=mapnik&marker=${storeLat},${storeLng}`
        : null;

    const exampleFee = (() => {
        const base = parseInt(formData.delivery_base_fee) || 0;
        const perKm = parseInt(formData.delivery_fee_per_km) || 2000;
        return base + 3 * perKm; // contoh 3 km
    })();

    const content = (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fade-in pb-24">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">Profil Toko</h1>
                    <p className="text-muted-foreground mt-1">Kelola informasi toko dan cabang Anda</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* ── Informasi Toko ── */}
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
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Logo Upload */}
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

                            {/* Owner & Nama Toko */}
                            <div className="grid md:grid-cols-2 gap-4">
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
                            </div>

                            {/* Lokasi / Alamat */}
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

                            {/* ── Koordinat GPS Toko ── */}
                            <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
                                <div className="flex items-center gap-2">
                                    <Crosshair className="w-4 h-4 text-primary" />
                                    <div>
                                        <p className="font-semibold text-sm">Koordinat GPS Toko</p>
                                        <p className="text-xs text-muted-foreground">Diperlukan untuk kalkulasi ongkir delivery otomatis</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Latitude</Label>
                                        <Input
                                            placeholder="-5.123456"
                                            value={formData.latitude}
                                            onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                                            className="text-xs font-mono"
                                            type="number"
                                            step="0.000001"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Longitude</Label>
                                        <Input
                                            placeholder="119.456789"
                                            value={formData.longitude}
                                            onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                                            className="text-xs font-mono"
                                            type="number"
                                            step="0.000001"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleUseMyLocation}
                                    disabled={gettingLocation}
                                    className="w-full"
                                >
                                    <Navigation className={`w-4 h-4 mr-2 ${gettingLocation ? 'animate-pulse' : ''}`} />
                                    {gettingLocation ? 'Mencari Lokasi...' : 'Gunakan Lokasi Saya (GPS Browser)'}
                                </Button>
                                {/* Map Preview */}
                                {storeMapUrl && (
                                    <div className="rounded-lg overflow-hidden border border-border h-48">
                                        <iframe
                                            src={storeMapUrl}
                                            width="100%"
                                            height="100%"
                                            style={{ border: 0 }}
                                            loading="lazy"
                                            title="Lokasi Toko"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* ── Konfigurasi Ongkir ── */}
                            <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
                                <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-primary" />
                                    <div>
                                        <p className="font-semibold text-sm">Tarif Ongkos Kirim</p>
                                        <p className="text-xs text-muted-foreground">Ongkir = Biaya dasar + (Jarak km × Tarif per km)</p>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-3 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Biaya Dasar (flat)</Label>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-muted-foreground shrink-0">Rp</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={formData.delivery_base_fee}
                                                onChange={e => setFormData({ ...formData, delivery_base_fee: e.target.value })}
                                                className="text-sm"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">Biaya tetap per pesanan</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Tarif per Kilometer</Label>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-muted-foreground shrink-0">Rp</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="2000"
                                                value={formData.delivery_fee_per_km}
                                                onChange={e => setFormData({ ...formData, delivery_fee_per_km: e.target.value })}
                                                className="text-sm"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">Per km dari toko</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Jarak Maks. (km)</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            placeholder="Kosong = tak terbatas"
                                            value={formData.delivery_max_km}
                                            onChange={e => setFormData({ ...formData, delivery_max_km: e.target.value })}
                                            className="text-sm"
                                        />
                                        <p className="text-xs text-muted-foreground">Kosongkan = tidak ada batas</p>
                                    </div>
                                </div>
                                {/* Contoh kalkulasi */}
                                <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 p-3 text-xs">
                                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <span className="text-primary/80">
                                        Contoh: Jarak 3 km → Ongkir = <strong>{formatCurrency(exampleFee)}</strong>
                                        {' '}(Rp {formData.delivery_base_fee || 0} + 3 km × Rp {formData.delivery_fee_per_km || 2000})
                                    </span>
                                </div>
                            </div>

                            {/* ── Konfigurasi Tarif Parkir ── */}
                            <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
                                <div className="flex items-center gap-2">
                                    <Car className="w-4 h-4 text-primary" />
                                    <div>
                                        <p className="font-semibold text-sm">Tarif Karcis Parkir</p>
                                        <p className="text-xs text-muted-foreground">Tarif flat per kendaraan, dicetak langsung di karcis saat masuk</p>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Tarif Motor</Label>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-muted-foreground shrink-0">Rp</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="2000"
                                                value={formData.parking_fee_motor}
                                                onChange={e => setFormData({ ...formData, parking_fee_motor: e.target.value })}
                                                className="text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs">Tarif Mobil</Label>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-muted-foreground shrink-0">Rp</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="3000"
                                                value={formData.parking_fee_mobil}
                                                onChange={e => setFormData({ ...formData, parking_fee_mobil: e.target.value })}
                                                className="text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Toggle proses jam keluar */}
                                <div className="flex items-center justify-between gap-4 rounded-lg bg-background/60 border border-border p-3">
                                    <div>
                                        <p className="text-sm font-medium">Proses Jam Keluar</p>
                                        <p className="text-xs text-muted-foreground">
                                            {parkingCheckoutEnabled
                                                ? 'Karcis dicatat jam masuk & jam keluar. Kendaraan harus di-checkout manual.'
                                                : 'Karcis hanya mencatat jam masuk, langsung selesai saat dicetak. Tidak perlu checkout.'}
                                        </p>
                                    </div>
                                    <Switch checked={parkingCheckoutEnabled} onCheckedChange={setParkingCheckoutEnabled} />
                                </div>
                            </div>

                            {/* ── Fitur Antrian ── */}
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/20 p-4">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-primary" />
                                    <div>
                                        <p className="font-semibold text-sm">Fitur Antrian</p>
                                        <p className="text-xs text-muted-foreground">
                                            Nyalakan untuk menampilkan menu Antrian, Antrian Makanan & Antrian Minuman di sidebar
                                        </p>
                                    </div>
                                </div>
                                <Switch checked={queueEnabled} onCheckedChange={setQueueEnabled} />
                            </div>

                            {/* ── Target Penjualan Harian ── */}
                            <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-4">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-primary" />
                                    <div>
                                        <p className="font-semibold text-sm">Target Penjualan Harian</p>
                                        <p className="text-xs text-muted-foreground">
                                            Dipakai untuk analisa capaian target di halaman Laporan
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Target per Hari</Label>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-muted-foreground shrink-0">Rp</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="6000000"
                                            value={formData.daily_target}
                                            onChange={e => setFormData({ ...formData, daily_target: e.target.value })}
                                            className="text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <Button type="submit" className="btn-primary" disabled={mutation.isPending}>
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
