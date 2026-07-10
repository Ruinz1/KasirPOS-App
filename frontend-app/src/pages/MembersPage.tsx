import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Star, Phone, UserPlus, Trash2, History, TrendingUp, Repeat, UserX, MessageCircle, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { memberApi } from '@/lib/memberApi';
import type { Member, MemberRFM, PointTransaction } from '@/types/member';
import { formatCurrency } from '@/utils/calculations';

type RfmType = 'spender' | 'frequency' | 'inactive';

const RFM_TABS: { key: RfmType; label: string; icon: typeof TrendingUp }[] = [
  { key: 'spender', label: 'Top Spender', icon: Wallet },
  { key: 'frequency', label: 'Paling Sering Datang', icon: Repeat },
  { key: 'inactive', label: 'Tidak Kembali', icon: UserX },
];

function toWhatsAppLink(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
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

  const [rfmType, setRfmType] = useState<RfmType>('spender');
  const [inactiveDays, setInactiveDays] = useState(60);
  const [rfmData, setRfmData] = useState<MemberRFM[]>([]);
  const [rfmLoading, setRfmLoading] = useState(false);

  const fetchMembers = async (q?: string) => {
    setLoading(true);
    try {
      const res = await memberApi.list(q);
      setMembers(res.data);
    } catch {
      toast.error('Gagal memuat data member');
    } finally {
      setLoading(false);
    }
  };

  const fetchRfm = async (q?: string) => {
    setRfmLoading(true);
    try {
      const res = await memberApi.rfm({ type: rfmType, inactive_days: inactiveDays, search: q });
      setRfmData(res.data);
    } catch {
      toast.error('Gagal memuat analitik RFM');
    } finally {
      setRfmLoading(false);
    }
  };

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

  const handleOpenDetail = async (member: Member) => {
    setDetailMember(member);
    setEditForm({ name: member.name, phone: member.phone });
    setLoadingDetail(true);
    try {
      const res = await memberApi.show(member.id);
      setDetailMember(res.data);
    } catch {
      toast.error('Gagal memuat detail member');
    } finally {
      setLoadingDetail(false);
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
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'list' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab('list')}
          >
            Daftar Member
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'rfm' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab('rfm')}
          >
            Analitik RFM
          </button>
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

            {/* List */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
            ) : members.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Belum ada member</p>
                <p className="text-sm">Member akan otomatis terdaftar saat checkout di POS</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member, idx) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors cursor-pointer"
                    onClick={() => handleOpenDetail(member)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {member.phone}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0">
                        <Star className="h-3 w-3 mr-1" />
                        {member.total_points} poin
                      </Badge>
                      {member.orders_count !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">{member.orders_count} transaksi</p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={e => { e.stopPropagation(); handleDelete(member); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* RFM Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {RFM_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setRfmType(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    rfmType === key
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-card border-border text-muted-foreground hover:border-amber-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
              {rfmType === 'inactive' && (
                <select
                  value={inactiveDays}
                  onChange={e => setInactiveDays(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg text-sm border border-border bg-card"
                >
                  <option value={30}>Belum kembali 1 bulan+</option>
                  <option value={60}>Belum kembali 2 bulan+</option>
                  <option value={90}>Belum kembali 3 bulan+</option>
                </select>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cari nama atau nomor telepon..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* RFM List */}
            {rfmLoading ? (
              <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
            ) : rfmData.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {rfmType === 'inactive' ? (
                  <>
                    <UserX className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Tidak ada member yang tidak kembali di periode ini</p>
                  </>
                ) : (
                  <>
                    <Star className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Belum ada data transaksi member</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {rfmData.map((member, idx) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors cursor-pointer"
                    onClick={() => handleOpenDetail(member)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{member.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {member.phone}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {member.frequency}x transaksi &bull; {formatCurrency(member.monetary)}
                        {member.last_order_at && (
                          <> &bull; Terakhir {new Date(member.last_order_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {rfmType === 'spender' && (
                        <p className="font-bold text-green-600">{formatCurrency(member.monetary)}</p>
                      )}
                      {rfmType === 'frequency' && (
                        <p className="font-bold text-blue-600">{member.frequency}x</p>
                      )}
                      {rfmType === 'inactive' && (
                        <p className="font-bold text-red-500">{member.recency_days} hari</p>
                      )}
                    </div>
                    {rfmType === 'inactive' && (
                      <a
                        href={toWhatsAppLink(member.phone)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="shrink-0"
                      >
                        <Button size="icon" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50">
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
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
            <Input placeholder="No. WhatsApp / Telepon" value={createForm.phone} onChange={e => setCreateForm(p => ({ ...p, phone: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? 'Mendaftarkan...' : 'Daftarkan Member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailMember} onOpenChange={v => { if (!v) { setDetailMember(null); setEditForm(null); } }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Detail Member
            </DialogTitle>
          </DialogHeader>

          {detailMember && editForm && (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Edit Form */}
              <div className="space-y-2">
                <Input value={editForm.name} onChange={e => setEditForm(p => p ? { ...p, name: e.target.value } : p)} placeholder="Nama" />
                <Input value={editForm.phone} onChange={e => setEditForm(p => p ? { ...p, phone: e.target.value } : p)} placeholder="Telepon" />
                <Button size="sm" className="w-full" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>

              {/* Points Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Poin Tersedia</p>
                  <p className="text-2xl font-bold text-amber-600">{detailMember.total_points}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Poin (lifetime)</p>
                  <p className="text-2xl font-bold">{detailMember.lifetime_points}</p>
                </div>
              </div>

              {/* Transaction History */}
              <div>
                <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" /> Riwayat Poin
                </p>
                {loadingDetail ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Memuat...</p>
                ) : !detailMember.point_transactions || detailMember.point_transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada riwayat poin</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {detailMember.point_transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/50">
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs">{tx.description || (tx.type === 'earn' ? 'Earn poin' : 'Redeem reward')}</p>
                          <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className={`font-bold ml-2 shrink-0 ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {tx.points > 0 ? '+' : ''}{tx.points}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Orders */}
              {(detailMember as any).orders && (detailMember as any).orders.length > 0 && (
                <div>
                  <p className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Transaksi Terakhir
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {(detailMember as any).orders.slice(0, 10).map((order: any) => (
                      <div key={order.id} className="flex justify-between text-sm p-2 rounded-lg bg-secondary/50">
                        <div>
                          <p className="font-medium">#{order.daily_number}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(order.total)}</p>
                          <p className="text-xs text-amber-600">+{order.points_earned || 0} poin</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
