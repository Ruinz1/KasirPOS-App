import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { formatCurrency } from '@/utils/calculations';
import {
  Plus,
  Search,
  Users,
  Edit2,
  Trash2,
  DollarSign,
  Calendar,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const roles = ['karyawan']; // Only allow creating employees, not admin or owner
const availablePositions = ['Barista', 'Kasir', 'Manager', 'Staff', 'Supervisor'];

interface Store {
  id: number;
  name: string;
  location: string;
}

export default function EmployeesPage() {
  const { user, isAdmin, loading: authLoading, hasPermission } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'karyawan',
    positions: [] as string[],
    salary_type: 'auto',
    base_salary: '0',
    bonus: '0',
    store_id: user?.store_id || null,
  });

  useEffect(() => {
    if (hasPermission('manage_employees')) {
      fetchEmployees();
      if (isAdmin()) {
        fetchStores();
      }
    } else if (!authLoading) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      toast.error('Gagal memuat data karyawan');
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await api.get('/stores-management');
      setStores(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.positions && emp.positions.some((p: string) => p.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const handleSubmit = async () => {
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        positions: formData.positions,
        salary_type: formData.salary_type,
        bonus: parseFloat(formData.bonus) || 0,
      };

      // Admin can select store, Owner uses their own store_id
      if (isAdmin()) {
        payload.store_id = formData.store_id;
      } else {
        payload.store_id = user?.store_id;
      }

      if (!editingEmployee) {
        payload.password = formData.password;
      }

      if (formData.salary_type === 'manual') {
        payload.base_salary = parseFloat(formData.base_salary) || 0;
      }

      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, payload);
        toast.success('Karyawan berhasil diupdate');
      } else {
        await api.post('/employees', payload);
        toast.success('Karyawan berhasil ditambahkan');
      }

      resetForm();
      fetchEmployees();
    } catch (error: any) {
      console.error('Failed to save employee:', error);
      toast.error(error.response?.data?.message || 'Gagal menyimpan karyawan');
    }
  };

  const handleEdit = (employee: any) => {
    setFormData({
      name: employee.name,
      email: employee.email,
      password: '',
      role: employee.role,
      positions: employee.positions || [],
      salary_type: employee.salary_type,
      base_salary: employee.base_salary?.toString() || '',
      bonus: employee.bonus?.toString() || '0',
      store_id: employee.store_id,
    });
    setEditingEmployee(employee);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus karyawan ini?')) return;

    try {
      await api.delete(`/employees/${id}`);
      toast.success('Karyawan berhasil dihapus');
      fetchEmployees();
    } catch (error: any) {
      console.error('Failed to delete employee:', error);
      toast.error(error.response?.data?.message || 'Gagal menghapus karyawan');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'karyawan',
      positions: [],
      salary_type: 'auto',
      base_salary: '',
      bonus: '0',
      store_id: user?.store_id || null,
    });
    setEditingEmployee(null);
    setIsAddDialogOpen(false);
  };

  const togglePosition = (position: string) => {
    setFormData(prev => ({
      ...prev,
      positions: prev.positions.includes(position)
        ? prev.positions.filter(p => p !== position)
        : [...prev.positions, position]
    }));
  };

  const getAutoSalaryPreview = () => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyRate = 50000;
    return formatCurrency(dailyRate * daysInMonth);
  };

  if (!hasPermission('manage_employees')) {
    return (
      <MainLayout>
        <div className="p-8 text-center text-muted-foreground">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold">Manajemen Karyawan</h1>
            <p className="text-muted-foreground mt-1">Kelola data karyawan dan gaji</p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Karyawan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nama Lengkap *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nama karyawan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>

                {!editingEmployee && (
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Minimal 8 karakter"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role *</Label>
                    <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Store Selection - Only for Admin */}
                  {isAdmin() && (
                    <div className="space-y-2">
                      <Label>Toko *</Label>
                      <Select
                        value={formData.store_id?.toString() || ''}
                        onValueChange={(val) => setFormData({ ...formData, store_id: parseInt(val) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih toko" />
                        </SelectTrigger>
                        <SelectContent>
                          {stores.map(store => (
                            <SelectItem key={store.id} value={store.id.toString()}>
                              {store.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Multiple Positions */}
                <div className="space-y-2">
                  <Label>Jabatan (Multiple Select) *</Label>
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {formData.positions.map(pos => (
                        <Badge key={pos} variant="default" className="flex items-center gap-1">
                          {pos}
                          <X
                            className="w-3 h-3 cursor-pointer hover:text-destructive"
                            onClick={() => togglePosition(pos)}
                          />
                        </Badge>
                      ))}
                      {formData.positions.length === 0 && (
                        <span className="text-sm text-muted-foreground">Pilih jabatan di bawah</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {availablePositions.map(position => (
                        <Button
                          key={position}
                          type="button"
                          size="sm"
                          variant={formData.positions.includes(position) ? "default" : "outline"}
                          onClick={() => togglePosition(position)}
                        >
                          {position}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Salary Settings */}
                <div className="space-y-2">
                  <Label>Tipe Gaji</Label>
                  <Select value={formData.salary_type} onValueChange={(val: any) => setFormData({ ...formData, salary_type: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (Rp 50.000/hari)</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.salary_type === 'auto' && (
                    <p className="text-xs text-muted-foreground">
                      Estimasi bulan ini: {getAutoSalaryPreview()}
                    </p>
                  )}
                </div>

                {formData.salary_type === 'manual' && (
                  <div className="space-y-2">
                    <Label>Gaji Pokok</Label>
                    <Input
                      type="number"
                      value={formData.base_salary}
                      onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Bonus</Label>
                  <Input
                    type="number"
                    value={formData.bonus}
                    onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={resetForm}>Batal</Button>
                  <Button onClick={handleSubmit}>
                    {editingEmployee ? 'Update' : 'Simpan'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari karyawan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Employees Table */}
        <div className="bg-card rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Nama</th>
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Role</th>
                  <th className="text-left p-4 font-medium">Jabatan</th>
                  {isAdmin() && <th className="text-left p-4 font-medium">Toko</th>}
                  <th className="text-left p-4 font-medium">Gaji</th>
                  <th className="text-right p-4 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isAdmin() ? 7 : 6} className="text-center p-8 text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin() ? 7 : 6} className="text-center p-8 text-muted-foreground">
                      Tidak ada karyawan ditemukan
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-muted/50">
                      <td className="p-4 font-medium">{emp.name}</td>
                      <td className="p-4 text-muted-foreground">{emp.email}</td>
                      <td className="p-4">
                        <Badge variant="outline">{emp.role}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.positions && emp.positions.length > 0 ? (
                            emp.positions.map((pos: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {pos}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </td>
                      {isAdmin() && (
                        <td className="p-4 text-sm text-muted-foreground">
                          {emp.store?.name || '-'}
                        </td>
                      )}
                      <td className="p-4">
                        <div className="text-sm space-y-1">
                          {emp.salary_type === 'auto' ? (
                            <>
                              <div className="font-medium text-primary">
                                {formatCurrency(emp.monthly_salary || 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Auto (Rp 50k/hari)
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-primary">
                                {formatCurrency(emp.base_salary || 0)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Manual
                              </div>
                            </>
                          )}
                          {emp.bonus > 0 && (
                            <div className="text-xs text-green-600 font-medium">
                              + {formatCurrency(emp.bonus)} bonus
                            </div>
                          )}
                          {emp.bonus > 0 && (
                            <div className="text-xs font-semibold text-foreground pt-1 border-t">
                              Total: {formatCurrency((emp.salary_type === 'auto' ? emp.monthly_salary : emp.base_salary) + emp.bonus)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(emp)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
