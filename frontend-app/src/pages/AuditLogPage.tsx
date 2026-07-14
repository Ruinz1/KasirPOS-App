import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollText, ChevronLeft, ChevronRight, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/skeletons';

interface AuditLog {
  id: number;
  user_name: string | null;
  user_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  'menu.hapus': { label: 'Hapus Menu', className: 'bg-red-100 text-red-700' },
  'menu.ubah_harga': { label: 'Ubah Harga', className: 'bg-amber-100 text-amber-700' },
  'shift.buka': { label: 'Buka Shift', className: 'bg-green-100 text-green-700' },
  'shift.tutup': { label: 'Tutup Shift', className: 'bg-blue-100 text-blue-700' },
  'order.batal': { label: 'Batal Order', className: 'bg-red-100 text-red-700' },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditLogPage() {
  const { user, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const canView = user && ['admin', 'owner'].includes(user.role);

  const { data: actions } = useQuery<string[]>({
    queryKey: ['audit-log-actions'],
    queryFn: async () => (await api.get('/audit-logs/actions')).data,
    enabled: !!canView,
    staleTime: 1000 * 60 * 5,
  });

  const { data, isLoading } = useQuery<Paginated<AuditLog>>({
    queryKey: ['audit-logs', page, action, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, per_page: 30 };
      if (action !== 'all') params.action = action;
      if (search) params.search = search;
      return (await api.get('/audit-logs', { params })).data;
    },
    enabled: !!canView,
    placeholderData: keepPreviousData,
  });

  if (!authLoading && !canView) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-full py-24 text-muted-foreground">
          <ShieldAlert className="w-12 h-12 mb-3 opacity-40" />
          <p>Halaman ini hanya untuk Admin dan Owner</p>
        </div>
      </MainLayout>
    );
  }

  const logs = data?.data ?? [];

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ScrollText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Audit Log</h1>
            <p className="text-sm text-muted-foreground">
              Riwayat aksi sensitif: hapus menu, ubah harga, buka/tutup shift, pembatalan order
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <form
            className="relative flex-1"
            onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cari keterangan atau nama user... (Enter)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </form>
          <Select value={action} onValueChange={(v) => { setPage(1); setAction(v); }}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Semua Aksi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              {(actions ?? []).map((a) => (
                <SelectItem key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Daftar log */}
        {isLoading ? (
          <TableSkeleton rows={10} cols={4} />
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada catatan audit</p>
            <p className="text-sm">Aksi sensitif akan otomatis tercatat di sini</p>
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Waktu</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">User</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Aksi</th>
                    <th className="px-4 py-3 font-medium">Keterangan</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => {
                    const badge = ACTION_LABELS[log.action] ?? { label: log.action, className: 'bg-secondary text-secondary-foreground' };
                    return (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(log.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium">{log.user_name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{log.user_role ?? ''}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="secondary" className={`border-0 ${badge.className}`}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 min-w-[280px]">{log.description}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{log.ip_address ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {data && data.last_page > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Halaman {data.current_page} dari {data.last_page} · {data.total} catatan
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}>
                Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
