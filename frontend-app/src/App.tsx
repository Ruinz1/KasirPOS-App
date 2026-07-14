import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { PageSkeleton } from "@/components/skeletons";

// Code splitting: setiap halaman jadi chunk terpisah, diunduh saat dibutuhkan
const Dashboard = lazy(() => import("./pages/Dashboard"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const MenuPage = lazy(() => import("./pages/MenuPage"));
const POSPage = lazy(() => import("./pages/POSPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const CapitalPage = lazy(() => import("./pages/CapitalPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const StorePage = lazy(() => import("./pages/StorePage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const StoresManagementPage = lazy(() => import("./pages/StoresManagementPage"));
const QueuePage = lazy(() => import("./pages/QueuePage"));
const FoodQueuePage = lazy(() => import("./pages/FoodQueuePage"));
const DrinkQueuePage = lazy(() => import("./pages/DrinkQueuePage"));
const OrderHistoryPage = lazy(() => import("./pages/OrderHistoryPage"));
const DailyShoppingPage = lazy(() => import("./pages/DailyShoppingPage"));
const LeavePage = lazy(() => import("./pages/LeavePage"));
const TablesPage = lazy(() => import("./pages/TablesPage"));
const CashierShiftPage = lazy(() => import("./pages/CashierShiftPage"));
const MembersPage = lazy(() => import("./pages/MembersPage"));
const PointRewardsPage = lazy(() => import("./pages/PointRewardsPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import("./pages/LoginPage"));

// Caching & background refetch global TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // data dianggap segar 1 menit — hindari refetch beruntun
      gcTime: 1000 * 60 * 10, // cache disimpan 10 menit
      refetchOnWindowFocus: true, // refetch di background saat tab kembali fokus
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    if (!userStr || Object.keys(JSON.parse(userStr)).length === 0) {
      localStorage.removeItem("token");
      return <Navigate to="/login" replace />;
    }

    const user = JSON.parse(userStr);
    // Force Owner to create store if not exists
    if (user.role === 'owner' && !user.store_id && window.location.pathname !== '/store') {
      return <Navigate to="/store" replace />;
    }

  } catch (e) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="app-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
              <Route path="/menu" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
              <Route path="/pos" element={<ProtectedRoute><POSPage /></ProtectedRoute>} />
              <Route path="/tables" element={<ProtectedRoute><TablesPage /></ProtectedRoute>} />
              <Route path="/queue" element={<ProtectedRoute><QueuePage /></ProtectedRoute>} />
              <Route path="/queue/food" element={<ProtectedRoute><FoodQueuePage /></ProtectedRoute>} />
              <Route path="/queue/drink" element={<ProtectedRoute><DrinkQueuePage /></ProtectedRoute>} />
              <Route path="/order-history" element={<ProtectedRoute><OrderHistoryPage /></ProtectedRoute>} />
              <Route path="/daily-shopping" element={<ProtectedRoute><DailyShoppingPage /></ProtectedRoute>} />
              <Route path="/cashier-shifts" element={<ProtectedRoute><CashierShiftPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
              <Route path="/leaves" element={<ProtectedRoute><LeavePage /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
              <Route path="/capital" element={<ProtectedRoute><CapitalPage /></ProtectedRoute>} />
              <Route path="/store" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
              <Route path="/roles" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
              <Route path="/stores-management" element={<ProtectedRoute><StoresManagementPage /></ProtectedRoute>} />
              <Route path="/members" element={<ProtectedRoute><MembersPage /></ProtectedRoute>} />
              <Route path="/point-rewards" element={<ProtectedRoute><PointRewardsPage /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
