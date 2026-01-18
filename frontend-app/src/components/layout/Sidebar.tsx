import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { ModeToggle } from '@/components/mode-toggle';
import {
  LayoutDashboard,
  Package,
  Coffee,
  ShoppingCart,
  BarChart3,
  Users,
  DollarSign,
  LogOut,
  Shield,
  Store,
  UserCog,
  Building2
} from 'lucide-react';

const allMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', permission: 'view_dashboard' },
  { icon: ShoppingCart, label: 'Kasir', path: '/pos', permission: 'manage_orders' },
  { icon: Package, label: 'Inventori', path: '/inventory', permission: 'view_inventory' },
  { icon: Coffee, label: 'Menu', path: '/menu', permission: 'view_menu' },
  { icon: BarChart3, label: 'Laporan', path: '/reports', permission: 'view_reports' },
  { icon: Users, label: 'Karyawan', path: '/employees', permission: 'manage_employees' },
  { icon: UserCog, label: 'User Sistem', path: '/users', permission: 'manage_users_system' },
  { icon: Building2, label: 'Manajemen Toko', path: '/stores-management', permission: 'manage_stores_system' },
  { icon: DollarSign, label: 'Modal', path: '/capital', permission: 'manage_capital' },
  { icon: Store, label: 'Toko', path: '/store', permission: 'owner_access' },
  { icon: Shield, label: 'Role & Izin', path: '/roles', permission: 'manage_roles_fallback' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, hasPermission, canEdit } = useAuth();

  const { data: storeData } = useQuery({
    queryKey: ['store'],
    queryFn: async () => {
      const res = await api.get('/store');
      return res.data;
    },
    enabled: !!user?.store_id, // Fetch only if user has a store assigned
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: false
  });

  const storeName = storeData?.name || 'KedaiPOS';
  const storeLocation = storeData?.location || '';

  // Filter menu items based on user permission
  const menuItems = allMenuItems.filter(item => {
    if (!user) return false;


    // Special handling for Roles page (Admin only)
    if (item.path === '/roles') {
      return user.role === 'admin';
    }

    // Special handling for Users page (Admin only)
    if (item.path === '/users') {
      return user.role === 'admin';
    }

    // Special handling for Stores Management (Admin only)
    if (item.path === '/stores-management') {
      return user.role === 'admin';
    }

    // Special handling for Store Profile (Owner only)
    if (item.path === '/store') {
      return user.role === 'owner';
    }

    return hasPermission(item.permission);
  });

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      toast({
        title: "Logout berhasil",
        description: "Anda telah keluar dari sistem",
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local storage even if API fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  return (
    <div className="w-64 bg-card border-r border-border h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src={storeData?.image ? `http://127.0.0.1:8000/storage/${storeData.image}` : "/logo.png"}
            alt="Logo"
            className="w-10 h-10 object-cover rounded-full bg-secondary"
          />
          <div className="overflow-hidden">
            <h1 className="font-display font-bold text-lg leading-tight truncate" title={storeName}>{storeName}</h1>
            <p className="text-xs text-muted-foreground truncate" title={storeLocation}>{storeLocation || 'Aplikasi Kasir'}</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-border bg-secondary/30 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
          <ModeToggle />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all hover:bg-destructive/10 text-destructive"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Keluar</span>
        </button>
      </div>
    </div>
  );
}
