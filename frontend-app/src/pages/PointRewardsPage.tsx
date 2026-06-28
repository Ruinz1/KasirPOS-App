import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Gift, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { rewardApi } from '@/lib/memberApi';
import api from '@/lib/api';
import type { PointReward } from '@/types/member';

interface MenuItemOption {
  id: number;
  name: string;
  price: number;
}

const emptyForm = {
  name: '',
  description: '',
  points_required: 15,
  menu_item_id: null as number | null,
  is_active: true,
};

export default function PointRewardsPage() {
  const [rewards, setRewards] = useState<PointReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PointReward | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const res = await rewardApi.list();
      setRewards(res.data);
    } catch {
      toast.error('Gagal memuat reward');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const res = await api.get<MenuItemOption[]>('/menu');
      setMenuItems(res.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchRewards();
    fetchMenuItems();
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (reward: PointReward) => {
    setEditTarget(reward);
    setForm({
      name: reward.name,
      description: reward.description || '',
      points_required: reward.points_required,
      menu_item_id: reward.menu_item_id,
      is_active: reward.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nama reward wajib diisi');
      return;
    }
    if (form.points_required < 1) {
      toast.error('Poin minimal 1');
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        const res = await rewardApi.update(editTarget.id, form);
        setRewards(prev => prev.map(r => r.id === editTarget.id ? res.data : r));
        toast.success('Reward diperbarui');
      } else {
        const res = await rewardApi.create(form);
        setRewards(prev => [...prev, res.data]);
        toast.success('Reward berhasil ditambahkan');
      }
      setDialogOpen(false);
    } catch {
      toast.error('Gagal menyimpan reward');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reward: PointReward) => {
    const result = await Swal.fire({
      title: `Hapus reward "${reward.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;
    try {
      await rewardApi.destroy(reward.id);
      setRewards(prev => prev.filter(r => r.id !== reward.id));
      toast.success('Reward dihapus');
    } catch {
      toast.error('Gagal menghapus reward');
    }
  };

  const handleToggleActive = async (reward: PointReward) => {
    try {
      const res = await rewardApi.update(reward.id, { is_active: !reward.is_active });
      setRewards(prev => prev.map(r => r.id === reward.id ? res.data : r));
    } catch {
      toast.error('Gagal mengubah status reward');
    }
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2">
              <Gift className="h-6 w-6 text-amber-500" />
              Reward Poin
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Atur hadiah yang bisa ditukar member dengan poin loyalitas
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Tambah Reward
          </Button>
        </div>

        {/* Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Cara Kerja Poin</p>
          <p>Setiap belanja <strong>Rp 10.000</strong> = <strong>1 Poin</strong>. Member bisa menukar poin dengan reward di bawah saat checkout.</p>
        </div>

        {/* Rewards List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Memuat...</div>
        ) : rewards.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Belum ada reward</p>
            <p className="text-sm">Tambahkan reward untuk menarik member berbelanja lebih banyak</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rewards.map(reward => (
              <div key={reward.id} className={`bg-card border rounded-xl p-4 transition-opacity ${reward.is_active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{reward.name}</p>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0 shrink-0">
                        <Star className="h-3 w-3 mr-1" />
                        {reward.points_required} poin
                      </Badge>
                    </div>
                    {reward.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{reward.description}</p>
                    )}
                    {reward.menu_item && (
                      <p className="text-xs text-green-700 mt-1">
                        Item: <strong>{reward.menu_item.name}</strong>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={reward.is_active}
                      onCheckedChange={() => handleToggleActive(reward)}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(reward)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(reward)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Reward' : 'Tambah Reward Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nama Reward</label>
              <Input className="mt-1" placeholder="Contoh: Gratis Es Teh" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Deskripsi (opsional)</label>
              <Input className="mt-1" placeholder="Deskripsi singkat" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Poin Dibutuhkan</label>
              <Input
                className="mt-1"
                type="number"
                min={1}
                value={form.points_required}
                onChange={e => setForm(p => ({ ...p, points_required: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Item Menu Gratis (opsional)</label>
              <Select
                value={form.menu_item_id ? String(form.menu_item_id) : 'none'}
                onValueChange={v => setForm(p => ({ ...p, menu_item_id: v === 'none' ? null : parseInt(v) }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih menu item..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa item spesifik</SelectItem>
                  {menuItems.map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Jika dipilih, item ini akan ditambahkan gratis saat redeem</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
              <span className="text-sm">Aktif (bisa ditukar member)</span>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : editTarget ? 'Simpan Perubahan' : 'Tambah Reward'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
