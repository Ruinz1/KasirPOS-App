import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { ModeToggle } from '@/components/mode-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
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
  Building2,
  ClipboardList,
  History,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  CalendarClock,
  Table
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useEffect } from 'react';

const allMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', permission: 'view_dashboard' },
  { icon: ShoppingCart, label: 'Kasir', path: '/pos', permission: 'manage_orders' },
  { icon: Table, label: 'Meja', path: '/tables', permission: 'manage_orders' },
  { icon: ClipboardList, label: 'Antrian', path: '/queue', permission: 'manage_orders' },
  { icon: History, label: 'Riwayat Pesanan', path: '/order-history', permission: 'manage_orders' },
  { icon: Package, label: 'Inventori', path: '/inventory', permission: 'view_inventory' },
  { icon: ShoppingBag, label: 'Belanja Harian', path: '/daily-shopping', permission: 'view_inventory' },
  { icon: Coffee, label: 'Menu', path: '/menu', permission: 'view_menu' },
  { icon: BarChart3, label: 'Laporan', path: '/reports', permission: 'view_reports' },
  { icon: CalendarClock, label: 'Manajemen Cuti', path: '/leaves', permission: 'access_leaves' },
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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

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

    // Special handling for Leaves (All users)
    if (item.path === '/leaves') {
      return true;
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
    <div
      className={`bg-card border-r border-border h-screen flex flex-col transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'
        }`}
    >
      {/* Toggle Button - Desktop */}
      <div className="absolute -right-3 top-20 z-50 invisible md:visible">
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6 rounded-full shadow-md bg-background border-border"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>

      {/* Logo */}
      <div className={`p-4 border-b border-border flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'w-10' : 'w-full'}`}>
          <img
            src={storeData?.image ? `/storage/${storeData.image}` : "/logo.png"}
            alt="Logo"
            className="w-10 h-10 object-cover rounded-full bg-secondary flex-shrink-0"
          />
          {!isCollapsed && (
            <div className="overflow-hidden min-w-0">
              <h1 className="font-display font-bold text-lg leading-tight truncate" title={storeName}>{storeName}</h1>
              <p className="text-xs text-muted-foreground truncate" title={storeLocation}>{storeLocation || 'Aplikasi Kasir'}</p>
            </div>
          )}
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className={`border-b border-border bg-secondary/30 flex items-center ${isCollapsed ? 'p-2 justify-center flex-col gap-2' : 'p-4 justify-between'}`}>
          {!isCollapsed ? (
            <div className="min-w-0 overflow-hidden">
              <p className="font-medium text-sm truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground capitalize truncate">{user.role}</p>
            </div>
          ) : null}
          <div className={`flex items-center gap-1 ${isCollapsed ? 'flex-col' : ''}`}>
            <ThemeToggle />
            <ModeToggle />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          const LinkContent = (
            <Link
              to={item.path}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all group ${isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:text-foreground'}`} />
              {!isCollapsed && <span className="font-medium truncate">{item.label}</span>}
            </Link>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.path} delayDuration={0}>
                <TooltipTrigger asChild>
                  {LinkContent}
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.path}>{LinkContent}</div>;
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-border">
        {isCollapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-3 px-3 py-3 rounded-lg w-full transition-all hover:bg-destructive/10 text-destructive"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Keluar</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg w-full transition-all hover:bg-destructive/10 text-destructive"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Keluar</span>
          </button>
        )}
      </div>
    </div>
  );
}
