import { useState } from 'react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Check, X, Pencil, ChefHat, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
    KitchenCategory,
    KITCHEN_CATEGORY_COLORS,
    kitchenColorClasses,
} from '@/lib/kitchenCategory';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    categories: KitchenCategory[];
    /** Dipanggil setiap kategori berubah agar daftar menu ikut disegarkan. */
    onChanged: () => void;
    /** Admin mengelola kategori milik toko tertentu. */
    storeId?: string | number | null;
}

/**
 * Kelola kategori dapur: tambah, ubah nama/warna, urutkan, hapus.
 *
 * Urutan di sini menentukan urutan grup di nota dapur & papan antrian, jadi
 * bagian yang paling sering dimasak bisa diletakkan paling atas.
 */
export function KitchenCategoryManager({ open, onOpenChange, categories, onChanged, storeId }: Props) {
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState<string>('orange');
    const [saving, setSaving] = useState(false);

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('orange');

    const storeParam = storeId ? { store_id: storeId } : {};

    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) {
            toast.error('Nama kategori belum diisi');
            return;
        }
        setSaving(true);
        try {
            await api.post('/kitchen-categories', { name, color: newColor, ...storeParam });
            toast.success(`Kategori "${name}" ditambahkan`);
            setNewName('');
            setNewColor('orange');
            onChanged();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Gagal menambah kategori');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (cat: KitchenCategory) => {
        setEditingId(cat.id);
        setEditName(cat.name);
        setEditColor(cat.color || 'orange');
    };

    const handleUpdate = async (cat: KitchenCategory) => {
        const name = editName.trim();
        if (!name) {
            toast.error('Nama kategori belum diisi');
            return;
        }
        setSaving(true);
        try {
            await api.put(`/kitchen-categories/${cat.id}`, { name, color: editColor });
            toast.success('Kategori diperbarui');
            setEditingId(null);
            onChanged();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Gagal memperbarui kategori');
        } finally {
            setSaving(false);
        }
    };

    /** Tukar urutan dengan kategori tetangga agar bisa diatur tanpa drag-and-drop. */
    const handleMove = async (index: number, direction: -1 | 1) => {
        const current = categories[index];
        const target = categories[index + direction];
        if (!target || !current) return;

        setSaving(true);
        try {
            await Promise.all([
                api.put(`/kitchen-categories/${current.id}`, { sort_order: target.sort_order }),
                api.put(`/kitchen-categories/${target.id}`, { sort_order: current.sort_order }),
            ]);
            onChanged();
        } catch {
            toast.error('Gagal mengubah urutan');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (cat: KitchenCategory) => {
        const count = cat.menu_items_count ?? 0;
        const warning = count > 0
            ? `\n\n${count} menu memakai kategori ini. Menu TIDAK akan terhapus, hanya kelompoknya dilepas.`
            : '';
        if (!confirm(`Hapus kategori "${cat.name}"?${warning}`)) return;

        setSaving(true);
        try {
            const { data } = await api.delete(`/kitchen-categories/${cat.id}`);
            toast.success(
                data?.menu_items_uncategorized
                    ? `Kategori dihapus · ${data.menu_items_uncategorized} menu jadi tanpa kategori`
                    : 'Kategori dihapus',
            );
            onChanged();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Gagal menghapus kategori');
        } finally {
            setSaving(false);
        }
    };

    const colorPicker = (value: string, onPick: (c: string) => void) => (
        <div className="flex flex-wrap gap-1.5">
            {KITCHEN_CATEGORY_COLORS.map((c) => (
                <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => onPick(c)}
                    className={`w-6 h-6 rounded-full transition-all ${kitchenColorClasses(c).dot} ${
                        value === c
                            ? 'ring-2 ring-offset-2 ring-foreground scale-110'
                            : 'opacity-60 hover:opacity-100'
                    }`}
                />
            ))}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-primary" />
                        Kategori Dapur
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground text-left">
                        Kelompokkan menu per bagian dapur (mis. Bakso, Nasi Goreng, Mie Goreng).
                        Urutan di sini menentukan urutan grup di nota dapur &amp; papan antrian.
                    </p>
                </DialogHeader>

                {/* Tambah kategori baru */}
                <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
                    <Label className="text-xs font-semibold">Tambah Kategori</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Contoh: Nasi Goreng"
                            value={newName}
                            maxLength={50}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                            className="text-sm"
                        />
                        <Button onClick={handleCreate} disabled={saving} size="sm" className="shrink-0">
                            <Plus className="w-4 h-4 mr-1" /> Tambah
                        </Button>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Warna label</Label>
                        {colorPicker(newColor, setNewColor)}
                    </div>
                </div>

                {/* Daftar kategori */}
                <div className="space-y-2">
                    {categories.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            <ChefHat className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            Belum ada kategori dapur.
                            <br />
                            Tambahkan di atas, lalu pilih kategorinya saat menambah/mengubah menu.
                        </div>
                    ) : (
                        categories.map((cat, index) => {
                            const cls = kitchenColorClasses(cat.color);
                            const isEditing = editingId === cat.id;

                            return (
                                <div
                                    key={cat.id}
                                    className="rounded-xl border border-border p-2.5 flex items-center gap-2"
                                >
                                    {/* Urutan tampil di nota dapur & antrian */}
                                    <div className="flex flex-col items-center shrink-0">
                                        <button
                                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                            disabled={index === 0 || saving}
                                            onClick={() => handleMove(index, -1)}
                                            title="Naikkan urutan"
                                        >
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="text-[9px] text-muted-foreground tabular-nums">
                                            {index + 1}
                                        </span>
                                        <button
                                            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                            disabled={index === categories.length - 1 || saving}
                                            onClick={() => handleMove(index, 1)}
                                            title="Turunkan urutan"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {isEditing ? (
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                value={editName}
                                                maxLength={50}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="text-sm h-8"
                                            />
                                            {colorPicker(editColor, setEditColor)}
                                        </div>
                                    ) : (
                                        <div className="flex-1 min-w-0">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold border ${cls.badge}`}
                                            >
                                                {cat.name}
                                            </span>
                                            <p className="text-[11px] text-muted-foreground mt-1">
                                                {cat.menu_items_count ?? 0} menu
                                            </p>
                                        </div>
                                    )}

                                    {/* Aksi */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditing ? (
                                            <>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-green-600"
                                                    disabled={saving}
                                                    onClick={() => handleUpdate(cat)}
                                                >
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8"
                                                    onClick={() => setEditingId(null)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8"
                                                    onClick={() => startEdit(cat)}
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-destructive"
                                                    disabled={saving}
                                                    onClick={() => handleDelete(cat)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
