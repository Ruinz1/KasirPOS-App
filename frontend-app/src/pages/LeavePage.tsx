import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Download, Loader2, Plus, Check, X, Trash2, CalendarRange, Wand2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { id as idLocale } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface Leave {
    id: number;
    user_id: number;
    user: { name: string; role: string };
    store_id: number;
    start_date: string;
    end_date: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    approved_by: number | null;
    approver?: { name: string };
    rejection_reason?: string;
    created_at: string;
}

interface Employee {
    id: number;
    name: string;
    role: string;
}

export default function LeavePage() {
    const { user, canEdit } = useAuth();
    const queryClient = useQueryClient();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isBatchOpen, setIsBatchOpen] = useState(false);

    // Single Create State
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [reason, setReason] = useState('');

    // Batch Create State
    const [batchDate, setBatchDate] = useState<Date>(new Date());
    const [schedule, setSchedule] = useState<{ [key: string]: number | null }>({});

    // Filters
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

    // Fetch Leaves
    const { data: leavesRaw, isLoading } = useQuery<Leave[]>({
        queryKey: ['leaves'],
        queryFn: async () => {
            const res = await api.get('/leaves');
            return res.data;
        },
    });

    const filteredLeaves = useMemo(() => {
        if (!leavesRaw) return [];
        return leavesRaw.filter(leave => {
            const date = new Date(leave.start_date);
            const matchesMonth = selectedMonth === 'all' || date.getMonth().toString() === selectedMonth;
            const matchesYear = selectedYear === 'all' || date.getFullYear().toString() === selectedYear;
            const matchesEmployee = selectedEmployee === 'all' || leave.user_id.toString() === selectedEmployee;

            return matchesMonth && matchesYear && matchesEmployee;
        });
    }, [leavesRaw, selectedMonth, selectedYear, selectedEmployee]);

    // Fetch Employees (Only for Admin/Owner)
    const { data: employees } = useQuery<Employee[]>({
        queryKey: ['employees', 'batch-list'],
        queryFn: async () => {
            const res = await api.get(user?.role === 'admin' ? '/employees?store_id=' + (user.store_id || 'all') : '/employees');
            // If owner, add self
            if (user?.role === 'owner') {
                // If fetching /employees returns only employees, we might need to manually add owner or rely on them being in the list if configured.
                // Usually owner is not in /employees list in my previous implementation (it filters role=karyawan). 
                // Let's manually fetch 'user' data or just mock it if current user is owner.
                // Ideally we should have an endpoint for "all users in store".
                // For now, let's append current user if owner
                return [...res.data, { id: user.id, name: user.name, role: 'owner' }];
            }
            return res.data;
        },
        enabled: canEdit && isBatchOpen,
    });



    // Mutations
    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await api.post('/leaves', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves'] });
            setIsCreateOpen(false);
            setStartDate(undefined);
            setEndDate(undefined);
            setReason('');
            MySwal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Pengajuan cuti berhasil dibuat',
            });
        },
        onError: (error: any) => {
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: error.response?.data?.message || error.message,
            });
        },
    });

    const batchCreateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await api.post('/leaves/batch', data);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['leaves'] });
            setIsBatchOpen(false);
            setSchedule({});
            MySwal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: data.message || 'Jadwal bulanan berhasil dibuat',
            });
        },
        onError: (error: any) => {
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: error.response?.data?.message || error.message,
            });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, rejection_reason }: { id: number; status: string; rejection_reason?: string }) => {
            const res = await api.put(`/leaves/${id}`, { status, rejection_reason });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves'] });
            MySwal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Status cuti diperbarui',
                timer: 1500,
                showConfirmButton: false
            });
        },
        onError: (error: any) => {
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: error.response?.data?.message || error.message,
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/leaves/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves'] });
            MySwal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Pengajuan cuti dihapus',
                timer: 1500,
                showConfirmButton: false
            });
        },
        onError: (error: any) => {
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: error.response?.data?.message || error.message,
            });
        },
    });

    // Handlers
    const handleSubmit = () => {
        if (!startDate || !endDate) {
            MySwal.fire({
                icon: 'warning',
                title: 'Perhatian',
                text: 'Pilih tanggal mulai dan selesai',
            });
            return;
        }
        createMutation.mutate({
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
            reason,
        });
    };

    const handleBatchSubmit = () => {
        // Collect all scheduled leaves
        const leavesToCreate = Object.entries(schedule)
            .filter(([_, userId]) => userId !== null)
            .map(([dateStr, userId]) => ({
                user_id: userId,
                start_date: dateStr,
                end_date: dateStr,
                reason: 'Jadwal Bulanan'
            }));

        if (leavesToCreate.length === 0) {
            MySwal.fire({
                icon: 'warning',
                title: 'Kosong',
                text: 'Belum ada jadwal yang diisi',
            });
            return;
        }

        MySwal.fire({
            title: 'Konfirmasi',
            text: `Akan membuat ${leavesToCreate.length} jadwal cuti?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Buat Jadwal',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                batchCreateMutation.mutate({ leaves: leavesToCreate });
            }
        });
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/leaves/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const filename = `leaves-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            MySwal.fire({
                icon: 'success',
                title: 'Berhasil',
                text: 'Data berhasil diexport',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Export error:', error);
            MySwal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal mengekspor data',
            });
        }
    };

    // Batch Generator Logic
    const daysInMonth = useMemo(() => {
        const start = startOfMonth(batchDate);
        const end = endOfMonth(batchDate);
        return eachDayOfInterval({ start, end });
    }, [batchDate]);

    const handleAutoFill = () => {
        if (!employees || employees.length === 0) return;

        MySwal.fire({
            title: 'Isi Otomatis?',
            text: "Jadwal akan diisi secara rotasi karyawan. Jadwal yang sudah ada akan ditimpa.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Isi Otomatis',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                const newSchedule = { ...schedule };
                let empIndex = 0;

                daysInMonth.forEach((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    newSchedule[dateStr] = employees[empIndex].id;
                    empIndex = (empIndex + 1) % employees.length;
                });

                setSchedule(newSchedule);
                MySwal.fire({
                    icon: 'success',
                    title: 'Selesai',
                    text: 'Jadwal otomatis diisi (rotasi)',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    };


    const getStatusBadge = (status: string) => {
        // ... same as before
        switch (status) {
            case 'approved': return <Badge className="bg-green-500 hover:bg-green-600">Disetujui</Badge>;
            case 'rejected': return <Badge variant="destructive">Ditolak</Badge>;
            default: return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 shadow-none border-yellow-200">Menunggu</Badge>;
        }
    };

    const months = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

    return (
        <MainLayout>
            <div className="p-6 space-y-6 fade-in h-full flex flex-col">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Manajemen Cuti</h1>
                        <p className="text-muted-foreground">Kelola pengajuan libur dan cuti karyawan.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {canEdit && (
                            <>
                                <Button variant="outline" onClick={handleExport}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Export Excel
                                </Button>
                                <Dialog open={isBatchOpen} onOpenChange={setIsBatchOpen}>
                                    <DialogTrigger asChild>
                                        {canEdit && (
                                            <Button variant="secondary">
                                                <CalendarRange className="mr-2 h-4 w-4" />
                                                Buat Jadwal Bulanan
                                            </Button>
                                        )}
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                                        <DialogHeader>
                                            <DialogTitle>Buat Jadwal Cuti Bulanan</DialogTitle>
                                            <DialogDescription>
                                                Atur jadwal cuti untuk satu bulan sekaligus.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="flex items-center justify-between py-2 border-b">
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" onClick={() => setBatchDate(d => new Date(d.setMonth(d.getMonth() - 1)))}>
                                                    &lt;
                                                </Button>
                                                <span className="font-semibold w-32 text-center">
                                                    {format(batchDate, 'MMMM yyyy', { locale: idLocale })}
                                                </span>
                                                <Button variant="outline" size="sm" onClick={() => setBatchDate(d => new Date(d.setMonth(d.getMonth() + 1)))}>
                                                    &gt;
                                                </Button>
                                            </div>
                                            <Button size="sm" onClick={handleAutoFill} disabled={!employees?.length}>
                                                <Wand2 className="mr-2 h-3 w-3" />
                                                Isi Otomatis (Rotasi)
                                            </Button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto min-h-[300px]">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[150px]">Tanggal</TableHead>
                                                        <TableHead className="w-[150px]">Hari</TableHead>
                                                        <TableHead>Karyawan Libur</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {daysInMonth.map((date) => {
                                                        const dateStr = format(date, 'yyyy-MM-dd');
                                                        const isSunday = date.getDay() === 0;

                                                        return (
                                                            <TableRow key={dateStr} className={isSunday ? 'bg-muted/30' : ''}>
                                                                <TableCell className="font-medium">
                                                                    {format(date, 'd MMMM yyyy', { locale: idLocale })}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {format(date, 'EEEE', { locale: idLocale })}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Select
                                                                        value={schedule[dateStr]?.toString() || "none"}
                                                                        onValueChange={(val) => {
                                                                            const newSchedule = { ...schedule };
                                                                            if (val === "none") delete newSchedule[dateStr];
                                                                            else newSchedule[dateStr] = parseInt(val);
                                                                            setSchedule(newSchedule);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="w-full">
                                                                            <SelectValue placeholder="Pilih karyawan..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">- Masuk Semua -</SelectItem>
                                                                            {employees?.map((emp) => (
                                                                                <SelectItem key={emp.id} value={emp.id.toString()}>
                                                                                    {emp.name} ({emp.role})
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        <DialogFooter className="mt-4 pt-2 border-t">
                                            <div className="flex justify-between w-full items-center">
                                                <span className="text-sm text-muted-foreground">
                                                    {Object.keys(schedule).length} hari dijadwalkan.
                                                </span>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" onClick={() => setIsBatchOpen(false)}>Batal</Button>
                                                    <Button onClick={handleBatchSubmit} disabled={batchCreateMutation.isPending}>
                                                        {batchCreateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                        <Save className="mr-2 h-4 w-4" />
                                                        Simpan Jadwal
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </>
                        )}

                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Ajukan Cuti
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Ajukan Permohonan Cuti</DialogTitle>
                                    <DialogDescription>
                                        Isi formulir berikut untuk mengajukan izin tidak masuk kerja.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Tanggal Mulai</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal",
                                                            !startDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {startDate ? format(startDate, "PPP", { locale: idLocale }) : <span>Pilih tanggal</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={startDate}
                                                        onSelect={setStartDate}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Tanggal Selesai</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal",
                                                            !endDate && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {endDate ? format(endDate, "PPP", { locale: idLocale }) : <span>Pilih tanggal</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={endDate}
                                                        onSelect={setEndDate}
                                                        disabled={(date) => startDate ? date < startDate : false}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Alasan</Label>
                                        <Textarea
                                            placeholder="Contoh: Acara keluarga, Sakit, dll."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Batal</Button>
                                    <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Ajukan
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Filters */}
                <Card className="border shadow-sm p-4 bg-background">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-2 min-w-[150px]">
                            <Label>Bulan</Label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Bulan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Bulan</SelectItem>
                                    {months.map((m, i) => (
                                        <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 min-w-[100px]">
                            <Label>Tahun</Label>
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Tahun" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua</SelectItem>
                                    {years.map((y) => (
                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {canEdit && (
                            <div className="space-y-2 min-w-[200px]">
                                <Label>Karyawan</Label>
                                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Karyawan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Karyawan</SelectItem>
                                        {employees?.map((emp) => (
                                            <SelectItem key={emp.id} value={emp.id.toString()}>{emp.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm flex-1">
                    <CardHeader>
                        <CardTitle>Riwayat Pengajuan</CardTitle>
                        <CardDescription>
                            {filteredLeaves.length} jadwal cuti ditemukan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border bg-background">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {canEdit && <TableHead>Nama</TableHead>}
                                        <TableHead>Hari Cuti</TableHead>
                                        <TableHead>Lama</TableHead>
                                        <TableHead>Alasan</TableHead>
                                        {canEdit && <TableHead>Status</TableHead>}
                                        {canEdit && <TableHead className="text-right">Aksi</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={canEdit ? 6 : 4} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredLeaves.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={canEdit ? 6 : 4} className="h-24 text-center text-muted-foreground">
                                                Tidak ada data cuti sesuai filter.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLeaves.map((leave) => {
                                            const duration = Math.ceil((new Date(leave.end_date).getTime() - new Date(leave.start_date).getTime()) / (1000 * 3600 * 24)) + 1;
                                            return (
                                                <TableRow key={leave.id}>
                                                    {canEdit && (
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium">{leave.user.name}</p>
                                                                <p className="text-xs text-muted-foreground capitalize">{leave.user.role}</p>
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                    <TableCell>
                                                        <div className="flex flex-col text-sm font-semibold text-primary">
                                                            <span>{format(new Date(leave.start_date), "EEEE, d MMM yyyy", { locale: idLocale })}</span>
                                                            {leave.start_date !== leave.end_date && (
                                                                <>
                                                                    <span className="text-muted-foreground text-xs font-normal">sampai</span>
                                                                    <span>{format(new Date(leave.end_date), "EEEE, d MMM yyyy", { locale: idLocale })}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {duration} Hari
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate" title={leave.reason}>
                                                        {leave.reason || '-'}
                                                    </TableCell>
                                                    {canEdit && (
                                                        <TableCell>
                                                            {getStatusBadge(leave.status)}
                                                            {leave.approved_by && (
                                                                <p className="text-[10px] text-muted-foreground mt-1">oleh: {leave.approver?.name}</p>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                    {canEdit && (
                                                        <TableCell className="text-right space-x-2">
                                                            {leave.status === 'pending' && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 w-8 p-0 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                                                        onClick={() => updateStatusMutation.mutate({ id: leave.id, status: 'approved' })}
                                                                        disabled={updateStatusMutation.isPending}
                                                                    >
                                                                        <Check className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                                                        onClick={() => {
                                                                            MySwal.fire({
                                                                                title: 'Tolak Pengajuan',
                                                                                text: 'Masukkan alasan penolakan (opsional):',
                                                                                input: 'text',
                                                                                showCancelButton: true,
                                                                                confirmButtonText: 'Tolak',
                                                                                cancelButtonText: 'Batal',
                                                                                confirmButtonColor: '#d33',
                                                                            }).then((result) => {
                                                                                if (result.isConfirmed) {
                                                                                    updateStatusMutation.mutate({ id: leave.id, status: 'rejected', rejection_reason: result.value });
                                                                                }
                                                                            });
                                                                        }}
                                                                        disabled={updateStatusMutation.isPending}
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {(leave.status !== 'pending' || !canEdit) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-muted-foreground"
                                                                    onClick={() => {
                                                                        MySwal.fire({
                                                                            title: 'Hapus Riwayat?',
                                                                            text: "Data yang dihapus tidak dapat dikembalikan!",
                                                                            icon: 'warning',
                                                                            showCancelButton: true,
                                                                            confirmButtonColor: '#d33',
                                                                            confirmButtonText: 'Ya, Hapus',
                                                                            cancelButtonText: 'Batal'
                                                                        }).then((result) => {
                                                                            if (result.isConfirmed) {
                                                                                deleteMutation.mutate(leave.id);
                                                                            }
                                                                        });
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    )}
                                                    {!canEdit && leave.status === 'pending' && (
                                                        <TableCell className="text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-destructive"
                                                                onClick={() => {
                                                                    MySwal.fire({
                                                                        title: 'Batalkan Pengajuan?',
                                                                        text: "Pengajuan yang dibatalkan akan dihapus.",
                                                                        icon: 'warning',
                                                                        showCancelButton: true,
                                                                        confirmButtonColor: '#d33',
                                                                        confirmButtonText: 'Ya, Batalkan',
                                                                        cancelButtonText: 'Tidak'
                                                                    }).then((result) => {
                                                                        if (result.isConfirmed) {
                                                                            deleteMutation.mutate(leave.id);
                                                                        }
                                                                    });
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
