import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { storageUrl } from '@/lib/utils';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';
import { Bike, Car, Printer, CheckCircle2, Ticket } from 'lucide-react';

interface ParkingTicket {
  id: number;
  ticket_number: string;
  vehicle_type: 'motor' | 'mobil';
  fee: number;
  status: 'active' | 'checked_out';
  created_at: string;
  checked_out_at?: string | null;
}

export default function ParkingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [storeInfo, setStoreInfo] = useState<{ name: string; address: string; image?: string }>({ name: 'KedaiPOS', address: '' });
  const [checkoutEnabled, setCheckoutEnabled] = useState(true);
  const [printTicket, setPrintTicket] = useState<ParkingTicket | null>(null);
  const [printMode, setPrintMode] = useState<'in' | 'out'>('in');

  useEffect(() => {
    api.get('/store').then(res => {
      setStoreInfo({
        name: res.data.name || 'KedaiPOS',
        address: res.data.location || '',
        image: res.data.image,
      });
      setCheckoutEnabled(res.data.parking_checkout_enabled ?? true);
    }).catch(() => {});
  }, []);

  const { data: tickets = [], isLoading } = useQuery<ParkingTicket[]>({
    queryKey: ['parking-tickets', 'active'],
    queryFn: async () => {
      const res = await api.get('/parking-tickets', { params: { status: 'active' } });
      return res.data;
    },
    refetchInterval: 15000,
  });

  const { data: stats } = useQuery({
    queryKey: ['parking-tickets', 'statistics'],
    queryFn: async () => {
      const res = await api.get('/parking-tickets/statistics');
      return res.data;
    },
    refetchInterval: 15000,
  });

  const createMutation = useMutation({
    mutationFn: async (vehicle_type: 'motor' | 'mobil') => {
      const res = await api.post('/parking-tickets', { vehicle_type });
      return res.data as ParkingTicket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['parking-tickets'] });
      // Jika toko tidak memakai proses jam keluar, karcis dari backend sudah langsung checked_out
      setPrintMode(ticket.status === 'checked_out' ? 'out' : 'in');
      setPrintTicket(ticket);
      setTimeout(() => window.print(), 300);
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal mencetak karcis',
        description: error.response?.data?.message || 'Terjadi kesalahan',
        variant: 'destructive',
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (ticket: ParkingTicket) => {
      const res = await api.post(`/parking-tickets/${ticket.id}/checkout`);
      return res.data as ParkingTicket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['parking-tickets'] });
      setPrintMode('out');
      setPrintTicket(ticket);
      setTimeout(() => window.print(), 300);
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal checkout',
        description: error.response?.data?.message || 'Terjadi kesalahan',
        variant: 'destructive',
      });
    },
  });

  const content = (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in pb-24">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Parkir</h1>
        <p className="text-muted-foreground mt-1">Cetak karcis parkir kendaraan masuk & proses kendaraan keluar</p>
      </div>

      {/* Cetak Karcis Baru */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            Kendaraan Masuk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Button
              type="button"
              className="h-24 flex-col gap-2 text-base"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate('motor')}
            >
              <Bike className="w-8 h-8" />
              Motor
            </Button>
            <Button
              type="button"
              className="h-24 flex-col gap-2 text-base"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate('mobil')}
            >
              <Car className="w-8 h-8" />
              Mobil
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistik Hari Ini */}
      {stats && (
        <div className={`grid grid-cols-2 gap-4 ${checkoutEnabled ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {checkoutEnabled && (
            <Card className="stat-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Sedang Parkir</p>
                <p className="text-2xl font-bold font-display text-primary">{stats.active_now}</p>
              </CardContent>
            </Card>
          )}
          <Card className="stat-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Tiket Hari Ini</p>
              <p className="text-2xl font-bold font-display">{stats.total_tickets}</p>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Motor / Mobil</p>
              <p className="text-2xl font-bold font-display">{stats.total_motor} / {stats.total_mobil}</p>
            </CardContent>
          </Card>
          <Card className="stat-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pendapatan Hari Ini</p>
              <p className="text-2xl font-bold font-display text-primary">{formatCurrency(stats.total_revenue)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daftar Kendaraan Aktif — hanya relevan jika proses jam keluar dipakai */}
      {checkoutEnabled && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle>Kendaraan Sedang Parkir ({tickets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada kendaraan yang sedang parkir</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className="border border-border rounded-xl p-4 flex flex-col gap-2 bg-secondary/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ticket.vehicle_type === 'motor' ? <Bike className="w-5 h-5" /> : <Car className="w-5 h-5" />}
                        <span className="font-bold font-mono text-lg">#{ticket.ticket_number}</span>
                      </div>
                      <span className="text-xs uppercase font-medium text-muted-foreground">{ticket.vehicle_type}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Masuk: {new Date(ticket.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-sm font-semibold">{formatCurrency(ticket.fee)}</div>
                    <Button
                      size="sm"
                      className="btn-primary mt-1"
                      disabled={checkoutMutation.isPending}
                      onClick={() => checkoutMutation.mutate(ticket)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      Kendaraan Keluar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hidden Print Ticket */}
      <div id="receipt-print" className="hidden">
        {printTicket && (
          <div className="p-0 text-center font-mono">
            <div className="flex justify-center mb-1">
              {storeInfo.image ? (
                <img
                  src={storageUrl(storeInfo.image)}
                  alt="Store Logo"
                  className="w-14 h-14 object-contain"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              ) : null}
            </div>
            <h1 className="text-lg font-bold uppercase tracking-wider mb-0 leading-none">{storeInfo.name}</h1>
            {storeInfo.address && (
              <p className="text-[10px] px-1 leading-tight mt-1">{storeInfo.address}</p>
            )}

            <div className="border-t-2 border-dashed border-black my-2 pt-2">
              <p className="text-sm font-bold uppercase">
                {printMode === 'in' ? 'KARCIS PARKIR' : checkoutEnabled ? 'BUKTI KELUAR' : 'KARCIS PARKIR (LUNAS)'}
              </p>
              <p className="text-4xl font-black my-2 tracking-widest">#{printTicket.ticket_number}</p>
              <p className="text-sm font-bold uppercase">{printTicket.vehicle_type}</p>
            </div>

            <div className="border-t border-dashed border-black my-2 pt-2 text-[11px] text-left space-y-1">
              <div className="flex justify-between">
                <span>Jam Masuk</span>
                <span>{new Date(printTicket.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {printMode === 'out' && checkoutEnabled && printTicket.checked_out_at && (
                <div className="flex justify-between">
                  <span>Jam Keluar</span>
                  <span>{new Date(printTicket.checked_out_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-dashed border-black/50 pt-1 mt-1">
                <span>TARIF</span>
                <span>{formatCurrency(printTicket.fee)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-black mt-2 pt-1 text-[9px]">
              {printMode === 'in' ? (
                <p>Simpan karcis ini & tunjukkan saat kendaraan keluar</p>
              ) : (
                <p>Terima kasih</p>
              )}
              <p className="mt-0.5">Petugas: {user?.name?.split(' ')[0]}</p>
            </div>
          </div>
        )}
      </div>

      {/* Print Styles for 58mm Thermal Printer */}
      <style>{`
        @media print {
          @page {
            size: 58mm auto;
            margin: 0mm;
          }

          html, body {
            margin: 0;
            padding: 0;
          }

          body * {
            visibility: hidden;
            height: 0;
          }

          #receipt-print,
          #receipt-print * {
            visibility: visible;
            height: auto;
          }

          #receipt-print {
            display: block !important;
            position: fixed;
            left: 0;
            top: 0;
            width: 58mm;
            padding: 0 6mm 5mm 6mm;
            margin: 0;
            z-index: 9999;
            box-sizing: border-box;
            font-family: 'Arial', sans-serif;
            font-size: 11px;
            line-height: 1.3;
            color: #000;
            background: white;
            font-weight: 400;
          }

          #receipt-print * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #000 !important;
          }

          #receipt-print img {
            display: block !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );

  return <MainLayout>{content}</MainLayout>;
}
