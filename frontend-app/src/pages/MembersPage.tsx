import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, Star, Phone, UserPlus, Trash2, History, TrendingUp,
  Repeat, UserX, MessageCircle, Wallet, BarChart2, UtensilsCrossed,
  Calendar, ChevronRight, X, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { memberApi } from '@/lib/memberApi';
import { pollWaStatus } from '@/lib/pollWaStatus';
import type { Member, MemberRFM, PointTransaction } from '@/types/member';
import { formatCurrency } from '@/utils/calculations';
import { CardGridSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';

type RfmType = 'spender' | 'frequency' | 'inactive';
type DetailTab = 'overview' | 'orders' | 'points';

const RFM_TABS: { key: RfmType; label: string; icon: typeof TrendingUp }[] = [
  { key: 'spender', label: 'Top Spender', icon: Wallet },
  { key: 'frequency', label: 'Paling Sering', icon: Repeat },
  { key: 'inactive', label: 'Tidak Kembali', icon: UserX },
];

// Segment color map
const SEGMENT_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  champion:  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300' },
  loyal:     { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  potential: { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300' },
  at_risk:   { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300' },
  lost:      { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-300' },
  occasional:{ bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  new:       { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
};

function toWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

function SegmentBadge({ segment }: { segment?: { key: string; label: string } }) {
  if (!segment) return null;
  const style = SEGMENT_STYLE[segment.key] ?? SEGMENT_STYLE.new;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
      {segment.label}
    </span>
  );
}

export default function MembersPage() {
  const [tab, setTab] = useState<'list' | 'rfm'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailMember, setDetailMember] = useState<(Member & { point_transactions?: PointTransaction[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; phone: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingWaId, setSendingWaId] = useState<number | null>(null);

  // Detail sub-tab
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');

  // Statistics for selected member
  const [memberStats, setMemberStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Order history for selected member
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderHistoryMonth, setOrderHistoryMonth] = useState('');

  // RFM
  const [rfmType, setRfmType] = useState<RfmType>('spender');
  const [inactiveDays, setInactiveDays] = useState(60);
  const [rfmData, setRfmData] = useState<MemberRFM[]>([]);
  const [rfmLoading, setRfmLoading] = useState(false);

  const fetchMembers = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await memberApi.list(q);
      setMembers(res.data);
    } catch {
      toast.error('Gagal memuat data member');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRfm = useCallback(async (q?: string) => {
    setRfmLoading(true);
    try {
      const res = await memberApi.rfm({ type: rfmType, inactive_days: inactiveDays, search: q });
      setRfmData(res.data);
    } catch {
      toast.error('Gagal memuat analitik RFM');
    } finally {
      setRfmLoading(false);
    }
  }, [rfmType, inactiveDays]);

  useEffect(() => {
    if (tab === 'list') fetchMembers(search || undefined);
    else fetchRfm(search || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rfmType, inactiveDays]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === 'list') fetchMembers(search || undefined);
      else fetchRfm(search || undefined);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const fetchMemberStats = useCallback(async (memberId: number) => {
    setLoadingStats(true);
    try {
      const res = await api.get(`/members/${memberId}/statistics`);
      setMemberStats(res.data);
    } catch {
      toast.error('Gagal memuat statistik member');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchOrderHistory = useCallback(async (memberId: number, month?: string) => {
    setLoadingOrders(true);
    try {
      const params: Record<string, string> = {};
      if (month) params.month = month;
      const res = await api.get(`/members/${memberId}/order-history`, { params });
      setOrderHistory(res.data.data ?? res.data);
    } catch {
      toast.error('Gagal memuat riwayat order');
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const handleOpenDetail = async (member: Member) => {
    setDetailMember(member);
    setEditForm({ name: member.name, phone: member.phone });
    setDetailTab('overview');
    setMemberStats(null);
    setOrderHistory([]);
    setLoadingDetail(true);
    try {
      const [detailRes] = await Promise.all([
        memberApi.show(member.id),
        fetchMemberStats(member.id),
      ]);
      setDetailMember(detailRes.data);
    } catch {
      toast.error('Gagal memuat detail member');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDetailTabChange = (t: DetailTab) => {
    setDetailTab(t);
    if (t === 'orders' && detailMember && orderHistory.length === 0) {
      fetchOrderHistory(detailMember.id, orderHistoryMonth || undefined);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.phone.trim()) {
      toast.error('Nama dan nomor telepon wajib diisi');
      return;
    }
    setCreating(true);
    try {
      await memberApi.create(createForm);
      toast.success('Member berhasil ditambahkan');
      setShowCreate(false);
      setCreateForm({ name: '', phone: '' });
      fetchMembers(search || undefined);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Gagal menambahkan member');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (member: Member) => {
    const result = await Swal.fire({
      title: `Hapus ${member.name}?`,
      text: 'Riwayat poin akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;
    try {
      await memberApi.destroy(member.id);
      toast.success('Member berhasil dihapus');
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch {
      toast.error('Gagal menghapus member');
    }
  };

  const handleSendPointsInfo = async (member: Member) => {
    setSendingWaId(member.id);
    try {
      await memberApi.sendPointsInfo(member.id);
      toast.info('Info poin sedang dikirim ke WhatsApp member...');
      pollWaStatus(
        async () => {
          const res = await memberApi.waInfoStatus(member.id);
          return { status: res.data.wa_info_status, method: res.data.wa_info_method };
        },
        (result) => {
          if (result.status === 'sent') {
            toast.success(result.method === 'text'
              ? 'Template belum aktif, info poin terkirim sebagai pesan teks'
              : 'Info poin terkirim via template WhatsApp');
          } else if (result.status === 'failed') {
            toast.warning('Gagal mengirim WhatsApp. Template mungkin belum disetujui.');
          }
        }
      ).finally(() => setSendingWaId(null));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Gagal mengirim WhatsApp');
      setSendingWaId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!detailMember || !editForm) return;
    setSaving(true);
    try {
      const res = await memberApi.update(detailMember.id, editForm);
      setDetailMember(prev => prev ? { ...prev, ...res.data } : prev);
      setMembers(prev => prev.map(m => m.id === detailMember.id ? { ...m, ...res.data } : m));
      toast.success('Data member diperbarui');
    } catch {
      toast.error('Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const totalMembers = members.length;
  const totalPoints = members.reduce((s, m) => s + m.total_points, 0);
  const topMember = members[0];

  // ── Render helpers ──────────────────────────────────────────────
  const renderMemberCard = (member: Member | MemberRFM, idx: number, showRfmMetric?: boolean) => {
    const rfm = member as MemberRFM;
    const segment = (rfm as any).segment;
    return (
      <div
        key={member.id}
        className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors cursor-pointer"
        onClick={() => handleOpenDetail(member)}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm font-bold shrink-0">
          {idx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{member.name}</p>
            {segment && <SegmentBadge segment={segment} />}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" /> {member.phone}
          </p>
          {rfm.frequency !== undefined && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {rfm.frequency}x transaksi • {formatCurrency(rfm.monetary)}
              {rfm.last_order_at && (
                <> • Terakhir {new Date(rfm.last_order_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</>
              )}
            </p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0">
            <Star className="h-3 w-3 mr-1" />{member.total_points} poin
          </Badge>
          {showRfmMetric && rfmType === 'spender' && rfm.monetary !== undefined && (
            <p className="text-xs font-bold text-green-600">{formatCurrency(rfm.monetary)}</p>
          )}
          {showRfmMetric && rfmType === 'frequency' && rfm.frequency !== undefined && (
            <p className="text-xs font-bold text-blue-600">{rfm.frequency}x</p>
          )}
          {showRfmMetric && rfmType === 'inactive' && rfm.recency_days !== undefined && (
            <p className="text-xs font-bold text-red-500">{rfm.recency_days} hari</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(!showRfmMetric || rfmType !== 'inactive') && (
            <Button size="icon" variant="outline"
              className="text-green-600 border-green-300 hover:bg-green-50 h-8 w-8"
              title="Kirim info poin via WhatsApp"
              disabled={sendingWaId === member.id}
              onClick={e => { e.stopPropagation(); handleSendPointsInfo(member); }}
            >
              <MessageCircle className={`h-3.5 w-3.5 ${sendingWaId === member.id ? 'animate-pulse' : ''}`} />
            </Button>
          )}
          {showRfmMetric && rfmType === 'inactive' && (
            <a href={toWhatsAppLink(member.phone)} target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}>
              <Button size="icon" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50 h-8 w-8">
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
          {!showRfmMetric && (
            <Button size="icon" variant="ghost"
              className="text-muted-foreground hover:text-destructive h-8 w-8"
              onClick={e => { e.stopPropagation(); handleDelete(member as Member); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Member & Loyalitas</h1>
            <p className="text-muted-foreground text-sm mt-1">Kelola pelanggan setia dan program poin</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Tambah Member
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {(['list', 'rfm'] as const).map(t => (
            <button key={t}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              onClick={() => setTab(t)}
            >
              {t === 'list' ? 'Daftar Member' : 'Analitik RFM & Segmentasi'}
            </button>
          ))}
        </div>

        {tab === 'list' ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Total Member</p>
                <p className="text-3xl font-bold mt-1">{totalMembers}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Total Poin Aktif</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">{totalPoints.toLocaleString()}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">Member Teratas</p>
                <p className="text-lg font-bold mt-1 truncate">{topMember?.name ?? '-'}</p>
                {topMember && <p className="text-xs text-amber-600">{topMember.total_points} poin</p>}
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari nama atau nomor telepon..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {loading ? (
              <CardGridSkeleton count={6} className="grid-cols-1" />
            ) : members.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Belum ada member</p>
                <p className="text-sm">Member akan otomatis terdaftar saat checkout di POS</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m, i) => renderMemberCard(m, i, false))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* RFM Filter */}
            <div className="flex flex-wrap gap-2">
              {RFM_TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setRfmType(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${rfmType === key ? 'bg-amber-500 border-amber-500 text-white' : 'bg-card border-border text-muted-foreground hover:border-amber-400'}`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
              {rfmType === 'inactive' && (
                <select value={inactiveDays} onChange={e => setInactiveDays(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm border border-border bg-card">
                  <option value={30}>Belum kembali 1 bulan+</option>
                  <option value={60}>Belum kembali 2 bulan+</option>
                  <option value={90}>Belum kembali 3 bulan+</option>
                </select>
              )}
            </div>

            {/* Segment Legend */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(SEGMENT_STYLE).map(([key, s]) => {
                const labels: Record<string, string> = {
                  champion: '🏆 Champion', loyal: '💛 Loyal', potential: '🌱 Potential',
                  at_risk: '⚠️ At Risk', lost: '💤 Lost', occasional: 'Sesekali', new: '🆕 Baru',
                };
                return (
                  <span key={key} className={`text-xs px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border}`}>
                    {labels[key]}
                  </span>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari nama atau nomor telepon..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {rfmLoading ? (
              <CardGridSkeleton count={6} className="grid-cols-1" />
            ) : rfmData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Belum ada data</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rfmData.map((m, i) => renderMemberCard(m, i, true))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={v => { setShowCreate(v); if (!v) setCreateForm({ name: '', phone: '' }); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tambah Member Baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nama lengkap" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="No. WhatsApp / Telepon" value={createForm.phone}
              onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? 'Mendaftarkan...' : 'Daftarkan Member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailMember} onOpenChange={v => { if (!v) { setDetailMember(null); setEditForm(null); setMemberStats(null); setOrderHistory([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-lg shrink-0">
              {detailMember?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold truncate">{detailMember?.name}</p>
                {memberStats?.segment && <SegmentBadge segment={memberStats.segment} />}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />{detailMember?.phone}
              </p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setDetailMember(null)} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Sub-tabs */}
          <div className="flex border-b border-border px-4">
            {([
              { key: 'overview', label: 'Ringkasan', icon: BarChart2 },
              { key: 'orders',   label: 'Riwayat Order', icon: UtensilsCrossed },
              { key: 'points',   label: 'Riwayat Poin', icon: Star },
            ] as { key: DetailTab; label: string; icon: typeof BarChart2 }[]).map(({ key, label, icon: Icon }) => (
              <button key={key}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${detailTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => handleDetailTabChange(key)}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── Overview Tab ── */}
            {detailTab === 'overview' && (
              <div className="p-4 space-y-4">
                {/* Edit Form */}
                {editForm && (
                  <div className="space-y-2 p-3 bg-secondary/30 rounded-lg">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Data</p>
                    <Input value={editForm.name} onChange={e => setEditForm(p => p ? { ...p, name: e.target.value } : p)} placeholder="Nama" />
                    <Input value={editForm.phone} onChange={e => setEditForm(p => p ? { ...p, phone: e.target.value } : p)} placeholder="Telepon" />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={handleSaveEdit} disabled={saving}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </Button>
                      <Button size="sm" variant="outline"
                        className="gap-1.5 text-green-600 border-green-300 hover:bg-green-50"
                        onClick={() => detailMember && handleSendPointsInfo(detailMember)}
                        disabled={sendingWaId === detailMember?.id}>
                        <MessageCircle className="h-3.5 w-3.5" />
                        {sendingWaId === detailMember?.id ? 'Mengirim...' : 'Kirim Poin WA'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Stats cards */}
                {loadingStats ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                  </div>
                ) : memberStats ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">Poin Tersedia</p>
                        <p className="text-2xl font-bold text-amber-600">{detailMember?.total_points}</p>
                      </div>
                      <div className="bg-secondary rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">Total Poin Lifetime</p>
                        <p className="text-2xl font-bold">{detailMember?.lifetime_points}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">Total Belanja</p>
                        <p className="text-lg font-bold text-green-700">{formatCurrency(memberStats.total_spent)}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">Rata-rata Order</p>
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(memberStats.avg_order_value)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Total Order</p>
                        <p className="font-bold">{memberStats.total_orders}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Terakhir kunjungan</p>
                        <p className="font-bold text-sm">
                          {memberStats.recency_days !== null ? `${memberStats.recency_days} hari lalu` : '-'}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Member sejak</p>
                        <p className="font-bold text-xs">
                          {detailMember?.created_at ? new Date(detailMember.created_at as string).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : '-'}
                        </p>
                      </div>
                    </div>

                    {/* Menu Favorit */}
                    {memberStats.favorite_menus?.length > 0 && (
                      <div>
                        <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <UtensilsCrossed className="h-4 w-4" /> Menu Favorit
                        </p>
                        <div className="space-y-1.5">
                          {memberStats.favorite_menus.map((m: any, i: number) => (
                            <div key={m.menu_item_id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                                <span className="font-medium">{m.name}</span>
                                <span className="text-xs text-muted-foreground">{m.category}</span>
                              </div>
                              <span className="text-xs font-bold text-primary">{m.total_qty}x</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Aktivitas bulanan (mini bar chart) */}
                    {memberStats.monthly_activity?.length > 0 && (
                      <div>
                        <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <BarChart2 className="h-4 w-4" /> Aktivitas Bulanan
                        </p>
                        <div className="flex items-end gap-1 h-16">
                          {memberStats.monthly_activity.map((m: any) => {
                            const maxSpent = Math.max(...memberStats.monthly_activity.map((x: any) => x.total_spent));
                            const heightPct = maxSpent > 0 ? (m.total_spent / maxSpent) * 100 : 0;
                            return (
                              <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5" title={`${m.month}: ${m.order_count}x | ${formatCurrency(m.total_spent)}`}>
                                <div className="w-full rounded-t-sm bg-amber-400 transition-all" style={{ height: `${Math.max(4, heightPct)}%` }} />
                                <p className="text-[8px] text-muted-foreground">{m.month.slice(5)}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}

            {/* ── Order History Tab ── */}
            {detailTab === 'orders' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="month"
                    className="w-44 text-sm"
                    value={orderHistoryMonth}
                    onChange={e => {
                      setOrderHistoryMonth(e.target.value);
                      if (detailMember) fetchOrderHistory(detailMember.id, e.target.value || undefined);
                    }}
                  />
                  {orderHistoryMonth && (
                    <Button size="sm" variant="ghost" onClick={() => {
                      setOrderHistoryMonth('');
                      if (detailMember) fetchOrderHistory(detailMember.id);
                    }}>
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />Semua
                    </Button>
                  )}
                </div>

                {loadingOrders ? (
                  <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
                ) : orderHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UtensilsCrossed className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Belum ada order</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderHistory.map((order: any) => (
                      <div key={order.id} className="p-3 rounded-xl border border-border bg-card">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm">#{order.daily_number} — {formatCurrency(order.total)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-amber-600 font-medium">+{order.points_earned ?? 0} poin</p>
                            <p className="text-xs text-muted-foreground capitalize">{order.payment_method ?? 'Paylater'}</p>
                          </div>
                        </div>
                        {order.items?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {order.items.slice(0, 4).map((item: any) => (
                              <span key={item.id} className="text-xs bg-secondary px-2 py-0.5 rounded-full">
                                {item.menu_item?.name} ×{item.quantity}
                              </span>
                            ))}
                            {order.items.length > 4 && (
                              <span className="text-xs text-muted-foreground">+{order.items.length - 4} lainnya</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Points History Tab ── */}
            {detailTab === 'points' && (
              <div className="p-4 space-y-2">
                {loadingDetail ? (
                  <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
                ) : !detailMember?.point_transactions || detailMember.point_transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Belum ada riwayat poin</p>
                  </div>
                ) : (
                  detailMember.point_transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-secondary/50">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium">{tx.description || (tx.type === 'earn' ? 'Earn poin' : 'Redeem reward')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className={`font-bold ml-2 shrink-0 ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
