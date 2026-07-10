import { useEffect, useState } from 'react';
import { Search, UserPlus, X, Star, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { memberApi, rewardApi } from '@/lib/memberApi';
import type { Member, PointReward } from '@/types/member';

interface Props {
  selectedMember: Member | null;
  selectedReward: PointReward | null;
  onMemberSelect: (member: Member | null) => void;
  onRewardSelect: (reward: PointReward | null) => void;
}

export function MemberSearch({ selectedMember, selectedReward, onMemberSelect, onRewardSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [rewards, setRewards] = useState<PointReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      setShowCreate(false);
      return;
    }
    setSearching(true);
    setShowCreate(false);
    const timer = setTimeout(async () => {
      try {
        const res = await memberApi.list(q);
        setResults(res.data);
        setSearched(true);
      } catch {
        toast.error('Gagal mencari member');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasDuplicateNames = (list: Member[]) => {
    const counts = new Map<string, number>();
    list.forEach(m => counts.set(m.name, (counts.get(m.name) || 0) + 1));
    return (name2: string) => (counts.get(name2) || 0) > 1;
  };

  const handleSelectResult = (member: Member) => {
    onMemberSelect(member);
    setOpen(false);
    setQuery('');
    setResults([]);
    setShowCreate(false);
    toast.success(`Selamat datang, ${member.name}! Poin: ${member.total_points}`);
  };

  const startCreate = () => {
    const q = query.trim();
    const looksLikePhone = /^[\d+][\d\s+-]*$/.test(q);
    setPhone(looksLikePhone ? q : '');
    setName(looksLikePhone ? '' : q);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Nama dan nomor telepon wajib diisi');
      return;
    }
    setCreating(true);
    try {
      const res = await memberApi.create({ name: name.trim(), phone: phone.trim() });
      onMemberSelect(res.data);
      setOpen(false);
      setQuery('');
      setPhone('');
      setName('');
      setResults([]);
      setShowCreate(false);
      toast.success(`Member ${res.data.name} berhasil didaftarkan!`);
    } catch {
      toast.error('Gagal mendaftarkan member');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenRewards = async () => {
    setLoadingRewards(true);
    setRewardOpen(true);
    try {
      const res = await rewardApi.list();
      setRewards(res.data.filter(r => r.is_active));
    } catch {
      toast.error('Gagal memuat reward');
    } finally {
      setLoadingRewards(false);
    }
  };

  const handleSelectReward = (reward: PointReward) => {
    if (!selectedMember) return;
    if (selectedMember.total_points < reward.points_required) {
      toast.error(`Poin tidak cukup. Butuh ${reward.points_required} poin, kamu punya ${selectedMember.total_points}`);
      return;
    }
    if (selectedReward?.id === reward.id) {
      onRewardSelect(null);
    } else {
      onRewardSelect(reward);
      toast.success(`Reward "${reward.name}" dipilih`);
    }
    setRewardOpen(false);
  };

  return (
    <div className="space-y-2">
      {selectedMember ? (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Star className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{selectedMember.name}</p>
            <p className="text-xs text-muted-foreground">{selectedMember.phone} &bull; <span className="font-semibold text-amber-600">{selectedMember.total_points} poin</span></p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={handleOpenRewards}>
              <Gift className="h-3 w-3" /> Tukar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { onMemberSelect(null); onRewardSelect(null); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full gap-2 text-muted-foreground" onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Tambah Member / Cari Poin
        </Button>
      )}

      {selectedReward && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-sm">
          <Gift className="h-4 w-4 text-green-600 shrink-0" />
          <span className="flex-1 truncate text-green-800">Reward: <strong>{selectedReward.name}</strong> (-{selectedReward.points_required} poin)</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onRewardSelect(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setQuery(''); setPhone(''); setName(''); setResults([]); setShowCreate(false); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cari atau Daftar Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau No. WhatsApp / Telepon"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {!showCreate && query.trim() && (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {searching ? (
                  <p className="text-sm text-center py-4 text-muted-foreground">Mencari...</p>
                ) : results.length > 0 ? (
                  (() => {
                    const isDuplicate = hasDuplicateNames(results);
                    return results.map(member => (
                      <button
                        key={member.id}
                        onClick={() => handleSelectResult(member)}
                        className="w-full text-left p-2.5 rounded-lg border border-border hover:border-amber-400 hover:bg-amber-50 transition-colors"
                      >
                        <p className="font-medium text-sm">{member.name}</p>
                        {isDuplicate(member.name) && (
                          <p className="text-xs text-muted-foreground">{member.phone}</p>
                        )}
                        <p className="text-xs text-amber-600 font-semibold">{member.total_points} poin</p>
                      </button>
                    ));
                  })()
                ) : searched ? (
                  <div className="text-center py-3 space-y-2">
                    <p className="text-sm text-muted-foreground">Member tidak ditemukan</p>
                    <Button size="sm" variant="outline" className="gap-2" onClick={startCreate}>
                      <UserPlus className="h-4 w-4" />
                      Daftarkan Member Baru
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {showCreate && (
              <div className="space-y-3 border-t pt-3">
                <p className="text-sm text-muted-foreground">Daftarkan member baru</p>
                <Input
                  placeholder="Nama pelanggan"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus={!phone}
                />
                <Input
                  placeholder="No. WhatsApp / Telepon"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  autoFocus={!!phone}
                />
                <Button className="w-full gap-2" onClick={handleCreate} disabled={creating}>
                  <UserPlus className="h-4 w-4" />
                  {creating ? 'Mendaftarkan...' : 'Daftarkan Member'}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reward Dialog */}
      <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              Tukar Poin
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <p className="text-sm text-muted-foreground -mt-1">
              Poin tersedia: <strong className="text-amber-600">{selectedMember.total_points} poin</strong>
            </p>
          )}
          {loadingRewards ? (
            <p className="text-sm text-center py-4 text-muted-foreground">Memuat reward...</p>
          ) : rewards.length === 0 ? (
            <p className="text-sm text-center py-4 text-muted-foreground">Belum ada reward tersedia</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {rewards.map(reward => {
                const canRedeem = selectedMember ? selectedMember.total_points >= reward.points_required : false;
                const isSelected = selectedReward?.id === reward.id;
                return (
                  <button
                    key={reward.id}
                    onClick={() => handleSelectReward(reward)}
                    disabled={!canRedeem}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-green-500 bg-green-50'
                        : canRedeem
                        ? 'border-border hover:border-amber-400 hover:bg-amber-50'
                        : 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{reward.name}</p>
                      <Badge variant={canRedeem ? 'default' : 'secondary'} className="text-xs">
                        {reward.points_required} poin
                      </Badge>
                    </div>
                    {reward.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{reward.description}</p>
                    )}
                    {reward.menu_item && (
                      <p className="text-xs text-green-700 mt-0.5">Gratis: {reward.menu_item.name}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
