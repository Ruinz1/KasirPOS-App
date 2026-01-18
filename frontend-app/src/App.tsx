import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import InventoryPage from "./pages/InventoryPage";
import MenuPage from "./pages/MenuPage";
import POSPage from "./pages/POSPage";
import ReportsPage from "./pages/ReportsPage";
import EmployeesPage from "./pages/EmployeesPage";
import CapitalPage from "./pages/CapitalPage";
import RolesPage from "./pages/RolesPage";
import StorePage from "./pages/StorePage";
import UsersPage from "./pages/UsersPage";
import StoresManagementPage from "./pages/StoresManagementPage";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  const location = window.location; // Use window.location as we are not inside Routes yet for useLocation? 
  // Wait, ProtectedRoute IS used inside Routes. But logic needs useLocation.
  // We cannot use useLocation here because ProtectedRoute is defined outside valid context in current file structure?
  // Let's check where App is rendered. It is inside BrowserRouter in App component.
  // BUT ProtectedRoute component definition itself is outside App component.
  // We can move ProtectedRoute definition inside App or just use window.location.pathname.
  // React Router usage is preferred. Let's move ProtectedRoute definition inside App or make it a separate component.
  // For smallest change, let's just use window.location.pathname.

  // Actually, ProtectedRoute is used as an element prop, so it is rendered inside Routes > Route.
  // So we can use useLocation hook if we move the definition or if we assume simpler check.

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
      // Using window.location.pathname is a bit raw but works if useLocation hook is not available
      return <Navigate to="/store" replace />;
    }

  } catch (e) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

import { ThemeProvider } from "@/components/theme-provider";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="app-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
            <Route path="/menu" element={<ProtectedRoute><MenuPage /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute><POSPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
            <Route path="/capital" element={<ProtectedRoute><CapitalPage /></ProtectedRoute>} />
            <Route path="/store" element={<ProtectedRoute><StorePage /></ProtectedRoute>} />
            <Route path="/roles" element={<ProtectedRoute><RolesPage /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="/stores-management" element={<ProtectedRoute><StoresManagementPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
