import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/admin/Dashboard";
import Catalog from "@/pages/admin/Catalog";
import Inventory from "@/pages/admin/Inventory";
import Replicas from "@/pages/admin/Replicas";
import Redirect from "@/pages/Redirect";
import NotFound from "@/pages/NotFound";
import CreateAdmin from "@/pages/CreateAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/create-admin" element={<CreateAdmin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            } />
            <Route path="/admin/catalog" element={
              <AdminLayout>
                <Catalog />
              </AdminLayout>
            } />
            <Route path="/admin/inventory" element={
              <AdminLayout>
                <Inventory />
              </AdminLayout>
            } />
            <Route path="/admin/replicas" element={
              <AdminLayout>
                <Replicas />
              </AdminLayout>
            } />
            <Route path="/admin/r/:token" element={<Redirect />} />
            <Route path="/r/:token" element={<Redirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
